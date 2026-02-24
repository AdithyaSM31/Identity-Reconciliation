import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
app.use(express.json());

const prisma = new PrismaClient();

app.get("/", (req: Request, res: Response) => {
  res.send("Bitespeed Identity Reconciliation API is running. Use POST /identify to interact with the service.");
});

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "Email or phoneNumber is required" });
    }

    const emailStr = email ? String(email) : null;
    const phoneStr = phoneNumber ? String(phoneNumber) : null;

    // Find all contacts that match either email or phoneNumber
    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email: emailStr ?? undefined },
          { phoneNumber: phoneStr ?? undefined },
        ].filter(Boolean) as any,
      },
    });

    if (matchingContacts.length === 0) {
      // No existing contacts, create a new primary contact
      const newContact = await prisma.contact.create({
        data: {
          email: emailStr,
          phoneNumber: phoneStr,
          linkPrecedence: "primary",
        },
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // Find all primary contacts for the matching contacts
    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
      let current = contact;
      while (current.linkedId) {
        const parent = await prisma.contact.findUnique({ where: { id: current.linkedId } });
        if (!parent) break;
        current = parent;
      }
      primaryIds.add(current.id);
    }

    const primaryIdsArray = Array.from(primaryIds);
    const allPrimaryContacts = await prisma.contact.findMany({
      where: { id: { in: primaryIdsArray } },
      orderBy: { createdAt: "asc" },
    });

    const mainPrimary = allPrimaryContacts[0];
    if (!mainPrimary) {
      return res.status(500).json({ error: "Primary contact not found" });
    }
    const otherPrimaries = allPrimaryContacts.slice(1);

    // Update other primaries to be secondary to mainPrimary
    for (const otherPrimary of otherPrimaries) {
      await prisma.contact.update({
        where: { id: otherPrimary.id },
        data: {
          linkedId: mainPrimary.id,
          linkPrecedence: "secondary",
          updatedAt: new Date(),
        },
      });

      // Update all contacts linked to otherPrimary to link to mainPrimary
      await prisma.contact.updateMany({
        where: { linkedId: otherPrimary.id },
        data: {
          linkedId: mainPrimary.id,
          updatedAt: new Date(),
        },
      });
    }

    // Fetch all contacts in the cluster
    const clusterContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: mainPrimary.id },
          { linkedId: mainPrimary.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const clusterEmails = new Set(clusterContacts.map(c => c.email).filter(Boolean));
    const clusterPhones = new Set(clusterContacts.map(c => c.phoneNumber).filter(Boolean));

    let isNewInfo = false;
    if (emailStr && !clusterEmails.has(emailStr)) isNewInfo = true;
    if (phoneStr && !clusterPhones.has(phoneStr)) isNewInfo = true;

    if (isNewInfo) {
      const newSecondary = await prisma.contact.create({
        data: {
          email: emailStr,
          phoneNumber: phoneStr,
          linkedId: mainPrimary.id,
          linkPrecedence: "secondary",
        },
      });
      clusterContacts.push(newSecondary);
    }

    // Prepare the response
    const emails = Array.from(new Set(clusterContacts.map(c => c.email).filter(Boolean)));
    const phoneNumbers = Array.from(new Set(clusterContacts.map(c => c.phoneNumber).filter(Boolean)));
    const secondaryContactIds = clusterContacts.filter(c => c.id !== mainPrimary.id).map(c => c.id);

    // Ensure primary contact's email and phone are first in the arrays
    if (mainPrimary.email) {
      const index = emails.indexOf(mainPrimary.email);
      if (index > -1) {
        emails.splice(index, 1);
        emails.unshift(mainPrimary.email);
      }
    }
    if (mainPrimary.phoneNumber) {
      const index = phoneNumbers.indexOf(mainPrimary.phoneNumber);
      if (index > -1) {
        phoneNumbers.splice(index, 1);
        phoneNumbers.unshift(mainPrimary.phoneNumber);
      }
    }

    return res.status(200).json({
      contact: {
        primaryContatctId: mainPrimary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

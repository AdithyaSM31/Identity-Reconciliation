"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
app.use(express_1.default.json());
const prisma = new client_1.PrismaClient();
app.post("/identify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, phoneNumber } = req.body;
        if (!email && !phoneNumber) {
            return res.status(400).json({ error: "Email or phoneNumber is required" });
        }
        const emailStr = email ? String(email) : null;
        const phoneStr = phoneNumber ? String(phoneNumber) : null;
        // Find all contacts that match either email or phoneNumber
        const matchingContacts = yield prisma.contact.findMany({
            where: {
                OR: [
                    { email: emailStr !== null && emailStr !== void 0 ? emailStr : undefined },
                    { phoneNumber: phoneStr !== null && phoneStr !== void 0 ? phoneStr : undefined },
                ].filter(Boolean),
            },
        });
        if (matchingContacts.length === 0) {
            // No existing contacts, create a new primary contact
            const newContact = yield prisma.contact.create({
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
        const primaryIds = new Set();
        for (const contact of matchingContacts) {
            let current = contact;
            while (current.linkedId) {
                const parent = yield prisma.contact.findUnique({ where: { id: current.linkedId } });
                if (!parent)
                    break;
                current = parent;
            }
            primaryIds.add(current.id);
        }
        const primaryIdsArray = Array.from(primaryIds);
        const allPrimaryContacts = yield prisma.contact.findMany({
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
            yield prisma.contact.update({
                where: { id: otherPrimary.id },
                data: {
                    linkedId: mainPrimary.id,
                    linkPrecedence: "secondary",
                    updatedAt: new Date(),
                },
            });
            // Update all contacts linked to otherPrimary to link to mainPrimary
            yield prisma.contact.updateMany({
                where: { linkedId: otherPrimary.id },
                data: {
                    linkedId: mainPrimary.id,
                    updatedAt: new Date(),
                },
            });
        }
        // Fetch all contacts in the cluster
        const clusterContacts = yield prisma.contact.findMany({
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
        if (emailStr && !clusterEmails.has(emailStr))
            isNewInfo = true;
        if (phoneStr && !clusterPhones.has(phoneStr))
            isNewInfo = true;
        if (isNewInfo) {
            const newSecondary = yield prisma.contact.create({
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

import { Router, Request, Response } from "express";
import { authenticateUser } from "./middleware";
import { monnifyService } from "../services/monnify-service";
import { db } from "../storage";
import { eq, and } from "drizzle-orm";
import { getDatabase, getSchema } from "../db";

export const monnifyPaymentRouter = Router();

// Endpoint for students to generate their dynamic/reserved virtual account
monnifyPaymentRouter.post("/create-account", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.email || !user.firstName) {
      return res.status(400).json({ error: "User profile incomplete. Email and First Name are required." });
    }

    const name = `${user.firstName} ${user.lastName || ''}`.trim();

    // Check if the user already has a virtual account
    const existingAccount = await db.getMonnifyVirtualAccountByUserId(user.id);
    if (existingAccount) {
      return res.json({
        accountNumber: existingAccount.accountNumber,
        bankName: existingAccount.bankName,
        accountReference: existingAccount.accountReference
      });
    }

    // Create a new virtual account
    const accountDetails = await monnifyService.createVirtualAccount(user.id, user.email, name);

    // Save to the database
    await db.createMonnifyVirtualAccount({
      userId: user.id,
      accountReference: accountDetails.accountReference,
      accountNumber: accountDetails.accountNumber,
      bankName: accountDetails.bankName
    });

    res.json(accountDetails);
  } catch (error: any) {
    console.error("Monnify create-account error:", error);
    res.status(500).json({ error: error.message || "Failed to create virtual account." });
  }
});

// Monnify Webhook endpoint
monnifyPaymentRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers['monnify-signature'] as string;
    
    // We expect raw body due to the middleware in index.ts
    // Convert to string for signature validation
    const payloadString = req.body.toString('utf8');
    
    // Validate signature
    if (!monnifyService.verifyWebhookSignature(signature, payloadString)) {
      console.warn("Invalid Monnify webhook signature");
      return res.status(401).send("Invalid signature");
    }

    // The body is raw, so we must parse it manually
    const event = JSON.parse(payloadString);

    // Ignore anything that is not a successful transaction
    if (event.eventType !== 'SUCCESSFUL_TRANSACTION') {
      return res.status(200).send("Ignored event type");
    }

    const { amountPaid, paymentReference, accountReference } = event.eventData;

    // Acknowledge Monnify immediately before long database queries
    res.status(200).send("Webhook received");

    // Process asynchronously so we don't timeout Monnify
    setImmediate(async () => {
      try {
        // 1. Check if we already processed this transaction (idempotency)
        // Need to check the examPayments table for this paymentReference
        const _db = getDatabase();
        const schema = getSchema();
        const existingTx = await db.getExamPaymentByReference(paymentReference);
        
        if (existingTx) {
          console.log(`Monnify webhook: Transaction ${paymentReference} already processed.`);
          return;
        }

        // 2. Find the user via accountReference
        const virtualAccount = await db.getMonnifyVirtualAccountByReference(accountReference);
        if (!virtualAccount) {
          console.error(`Monnify webhook: Unknown account reference ${accountReference}`);
          return;
        }

        const userId = virtualAccount.userId;

        // 3. Find the associated student record
        const student = await db.getStudentByUserId(userId);
        if (!student) {
          console.error(`Monnify webhook: Student profile not found for user ${userId}`);
          return;
        }

        // 4. Find the current term
        const currentTerm = await db.getCurrentTerm();
        if (!currentTerm) {
          console.error(`Monnify webhook: No active term found. Payment stored but exam not guaranteed to unlock correctly.`);
          // We can't insert into examPayments without a termId, safely abort or handle it
          return;
        }

        // 5. Save the transaction and unlock the exam
        console.log(`Unlocking exam for student ${student.id} via Monnify payment ${paymentReference}`);

        // Update user's examUnlocked flag to true
        await db.updateUser(userId, { examUnlocked: true });

        // Record the payment
        await db.createExamPayment({
          studentId: student.id,
          termId: currentTerm.id,
          amountPaid: Math.floor(amountPaid), // Amount paid is typical in whole currency
          paymentMethod: 'bank_transfer',
          paymentReference: paymentReference,
          status: 'paid',
          provider: 'monnify',
          gatewayResponse: JSON.stringify(event.eventData),
          paidAt: new Date(),
        });

      } catch (innerError) {
        console.error("Monnify async webhook processing error:", innerError);
      }
    });

  } catch (error: any) {
    console.error("Monnify webhook error:", error);
    if (!res.headersSent) {
      res.status(500).send("Webhook processing error");
    }
  }
});

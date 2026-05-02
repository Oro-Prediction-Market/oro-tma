import { request } from "./client";
import type {
  DKBankPaymentRequest,
  PaymentResponse,
  PaymentStatus,
} from "@shared/types/payment";

/**
 * DK Bank (Druk PNB Bank) Payment Integration
 *
 * This module handles BTN (Bhutanese Ngultrum) payments via DK Bank
 * for Bhutanese users betting on archery matches.
 *
 * INTEGRATES WITH BACKEND PAYMENT SERVICE
 */

/**
 * Initiate a payment via DK Bank through backend
 *
 * This calls the backend payment service which handles
 * the actual DK Bank integration
 */
export async function initiateDKBankPayment(
  payment: DKBankPaymentRequest,
): Promise<PaymentResponse> {
  try {
    const response = await request<PaymentResponse>(
      "/payments/dkbank/initiate",
      {
        method: "POST",
        body: JSON.stringify(payment),
      },
    );

    return response;
  } catch (error: any) {
    throw new Error(error.message || "DK Bank payment initiation failed");
  }
}

/**
 * Step 2: Submit OTP to confirm a DK Bank payment
 */
export async function confirmDKBankPayment(
  paymentId: string,
  otp: string,
): Promise<PaymentResponse> {
  try {
    return await request<PaymentResponse>("/payments/dkbank/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentId, otp }),
    });
  } catch (error: any) {
    throw new Error(error.message || "DK Bank payment confirmation failed");
  }
}

/**
 * Check payment status through backend
 */
export async function checkDKBankPaymentStatus(
  paymentId: string,
): Promise<PaymentStatus> {
  try {
    const response = await request<PaymentStatus>(
      `/payments/dkbank/status/${paymentId}`,
    );
    return response;
  } catch (error: any) {
    throw new Error(error.message || "Failed to check payment status");
  }
}

/**
 * Initiate a wallet top-up (deposit) via DK Bank.
 * Uses the same /payments/dkbank/initiate endpoint.
 */
export async function initiateDKBankDeposit(params: {
  amount: number;
  cid: string; // 11-digit Bhutanese CID number
  description?: string;
}): Promise<PaymentResponse> {
  return initiateDKBankPayment({
    amount: params.amount,
    cid: params.cid,
    description: params.description || "Oro wallet top-up",
  });
}

/**
 * Confirm a wallet deposit OTP (alias of confirmDKBankPayment).
 */
export async function confirmDKBankDeposit(
  paymentId: string,
  otp: string,
): Promise<PaymentResponse> {
  return confirmDKBankPayment(paymentId, otp);
}

/**
 * Step 1: Initiate a withdrawal from Oro balance → DK Bank account.
 * Requires the user to have a linked DK Bank account (dkCid + dkAccountNumber).
 * Sends an OTP to the user's Telegram chat.
 */
export async function initiateDKBankWithdrawal(params: {
  amount: number;
}): Promise<PaymentResponse> {
  try {
    return await request<PaymentResponse>(
      "/payments/dkbank/withdraw/initiate",
      {
        method: "POST",
        body: JSON.stringify({ amount: params.amount }),
      },
    );
  } catch (error: any) {
    throw new Error(error.message || "DK Bank withdrawal initiation failed");
  }
}

/**
 * Step 2: Confirm a withdrawal with the Telegram OTP.
 */
export async function confirmDKBankWithdrawal(
  paymentId: string,
  otp: string,
): Promise<PaymentResponse> {
  try {
    return await request<PaymentResponse>("/payments/dkbank/withdraw/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentId, otp }),
    });
  } catch (error: any) {
    throw new Error(error.message || "DK Bank withdrawal confirmation failed");
  }
}

/**
 * Format BTN currency for display
 */
export function formatBTN(amount: number): string {
  return `Nu. ${amount.toLocaleString("en-BT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Validate Bhutanese CID number
 * Format: exactly 11 numeric digits
 */
export function validateCID(cid: string): boolean {
  const cleaned = cid.replace(/\s+/g, "");
  return /^\d{11}$/.test(cleaned);
}

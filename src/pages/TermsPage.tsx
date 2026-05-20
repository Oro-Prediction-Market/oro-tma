import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TERMS_SECTIONS = [
  {
    heading: "1. Agreement and Acceptance",
    body: "These Terms and Conditions (Terms) govern access to and use of Oro Prediction Market services, including the website, web application, Telegram Mini App, wallet features, prediction market participation, and related services (collectively, Platform). By creating an account, accessing, or using the Platform, you acknowledge and agree to be bound by these Terms and by any additional published policies that apply to specific features. If you do not agree, you must not use the Platform.",
  },
  {
    heading: "2. Eligibility and Regulatory Compliance",
    body: "You represent and warrant that you have the Dk Bank account, have legal capacity to enter binding agreements, your use of the Platform is lawful in your jurisdiction, and all information provided to 21Tech is accurate, current, and complete. 21Tech may require identity and account verification at any time. Access may be refused, restricted, suspended, or terminated where legal, compliance, fraud, AML, sanctions, or risk concerns arise.",
  },
  {
    heading: "3. Jurisdiction and Applicable Law",
    body: "These Terms are governed by the laws of the Kingdom of Bhutan. The Platform is intended for use in compliance with Bhutan law and all applicable financial, consumer, tax, AML/CFT, and digital services requirements. Users remain responsible for complying with any local laws applicable to them.",
  },
  {
    heading: "4. Account Registration, Security, and Identity Integrity",
    body: "You are responsible for all activities under your account. You must protect credentials and authentication devices, not share account access with others, and immediately report suspected unauthorized access. You must not create multiple accounts to circumvent restrictions, limits, promotions, or responsible gaming controls. 21Tech may apply risk controls including device checks, behavior monitoring, step-up verification, account holds, and transaction review.",
  },
  {
    heading: "5. Wallet and Payments",
    body: "The Platform provides an internal wallet for predictions, winnings, and supported balance operations. Wallet balances are not bank deposits and do not earn interest unless expressly stated. Top ups and cash outs are processed through supported partners including DK Bank integrations where available, subject to provider availability, security and compliance checks, additional user verification, and legal and regulatory review.",
  },
  {
    heading: "6. Market Participation and Outcomes",
    body: "Market rules are displayed in-app and may include entry fees, participation windows, resolution criteria, and payout structures. By placing a prediction, you accept that specific market's published rules at entry time. Entries submitted after closure, invalid entries, or entries violating policy may be rejected. Where a market is cancelled or cannot proceed, 21Tech may apply the market's published treatment (including refund where applicable).",
  },
  {
    heading: "7. Market Resolution and Dispute Windows",
    body: "Oro uses transparent resolution mechanisms including external data sources (e.g., api.ter.bt for exchange rates) and community dispute windows. In the event of discrepancy between client display and authoritative backend records, authoritative backend records prevail, subject to legal review and audit correction procedures.",
  },
  {
    heading: "8. Fees, Taxes, and Withholding",
    body: "Applicable fees, charges, and limits are displayed in-app and may be updated with notice consistent with law. Tax treatment may depend on winnings amount, user profile, and applicable law. 21Tech may withhold tax amounts where required by Bhutan law, report taxable payouts where legally required, and request tax-relevant information from users before payout.",
  },
  {
    heading: "9. Responsible Gaming and Player Protection",
    body: "21Tech may enforce spending limits, entry-frequency controls, cooling-off periods, temporary or permanent self-exclusion, and mandatory compliance interventions. Platform-level protection controls prevail over user-selected settings where conflict exists.",
  },
  {
    heading: "10. Prohibited Conduct",
    body: "You must not provide false identity or payment information, commit or attempt fraud, collusion, abuse, or manipulation, use bots, scripts, reverse engineering, or unauthorized automation, interfere with security or platform stability, or use the Platform for money laundering, terrorist financing, sanctions evasion, or unlawful activity. Violation may result in immediate restriction, suspension, termination, fund hold, cancellation of benefits, and reporting to competent authorities.",
  },
  {
    heading: "11. Promotions, Bonuses, and Campaign Terms",
    body: "Promotional offers may be subject to separate campaign terms. 21Tech may revoke or recover promotional credits or winnings obtained through abuse, duplicate accounts, prohibited conduct, or error.",
  },
  {
    heading: "12. Suspension, Restriction, Termination, and Dormancy",
    body: "21Tech may suspend, restrict, or terminate any account at its discretion where required for legal compliance, security, fraud prevention, operational integrity, or material Terms breach. Dormant accounts may be subject to maintenance actions as disclosed in policy and permitted by law.",
  },
  {
    heading: "13. Intellectual Property",
    body: "All Platform software, branding, interfaces, content, and marks are owned by or licensed to 21Tech and protected by applicable law. No rights are granted other than a limited, revocable, non-transferable license for lawful personal use.",
  },
  {
    heading: "14. Data Use and Privacy",
    body: "Personal data is processed according to the Oro Privacy Policy, which forms part of these Terms.",
  },
  {
    heading: "15. Service Availability and Force Majeure",
    body: "21Tech may modify, suspend, or discontinue services at any time for maintenance, security, legal compliance, or business reasons. 21Tech is not liable for delay or failure caused by events beyond reasonable control.",
  },
  {
    heading: "16. Disclaimers",
    body: 'To the maximum extent permitted by law, Platform services are provided on an "as available" and "as is" basis. No guarantee is made of uninterrupted service, error-free operation, or guaranteed winnings. No advice provided through the Platform constitutes legal, financial, or tax advice.',
  },
  {
    heading: "17. Limitation of Liability",
    body: "To the fullest extent permitted by Bhutan law, 21Tech and affiliated parties are not liable for indirect, incidental, consequential, exemplary, or punitive damages. For direct damages, aggregate liability is limited to the total net fees paid by the user to 21Tech in the 12 months preceding the event giving rise to claim.",
  },
  {
    heading: "18. Dispute Resolution",
    body: "When a market is resolved, a dispute window (default 60 minutes) opens during which any participant with an active position may raise an objection. Raising an objection requires a fixed Nu 10 bond. If the admin agrees with the objection and overturns the resolution, the bond is returned plus a reward share. If the admin upholds their original decision, the bond is forfeited. After the dispute window closes with no successful objections, the resolution is finalized and payouts are distributed. For general platform complaints, contact oro@romtech.bt with full facts and supporting records.",
  },
  {
    heading: "19. Amendments",
    body: "21Tech may amend these Terms at any time. Updated Terms become effective on publication. Continued use after effective date constitutes acceptance.",
  },
  {
    heading: "20. Severability and Entire Agreement",
    body: "If any provision is held invalid or unenforceable, remaining provisions remain in full force. These Terms, together with incorporated policies, form the entire agreement between you and 21Tech regarding Platform use.",
  },
];

const PRIVACY_SECTIONS = [
  {
    heading: "1. Introduction",
    body: "This Privacy Policy explains how 21Tech (Oro) collects, uses, stores, shares, and protects personal data when you use Oro services, including web, app, Telegram integrations, wallet/payment features, and related support channels. By using the Platform, you acknowledge this Privacy Policy.",
  },
  {
    heading: "2. Data We Collect",
    body: "We collect Account and Identity Data (name, username, profile information, CID, platform identifiers, verification information), Contact Data (email address, phone number, support communications), Authentication and Security Data (login timestamps, access logs, session metadata, device metadata, fraud risk signals), Transaction and Wallet Data (top up and cash out records, prediction payments, winnings, refunds, balance events, payment references), and Participation Data (market entries, outcomes, prediction history).",
  },
  {
    heading: "3. Sources of Data",
    body: "We collect data directly from you, from your use of Platform services, from payment/banking and authentication partners, from anti-fraud and compliance providers, and from lawful authority communications.",
  },
  {
    heading: "4. Purpose of Processing",
    body: "We process personal data to register and manage accounts, authenticate users and secure access, operate predictions, payouts, wallet functions, and support, detect and prevent fraud or abuse, maintain legal, tax, audit, AML/CFT, and sanctions compliance, improve platform quality and analytics, and communicate service and legal notices.",
  },
  {
    heading: "5. Legal Bases",
    body: "Depending on jurisdiction and processing activity, legal bases may include performance of contract, compliance with legal obligations, legitimate interests (security, fraud prevention, product integrity), and consent where required by law.",
  },
  {
    heading: "6. Data Sharing and Disclosure",
    body: "We may share personal data with banking/payment partners including DK Bank-related channels, identity and authentication partners, cloud hosting, analytics, security, messaging, and support vendors, and law enforcement, regulators, courts, and competent authorities where legally required. We do not sell personal data.",
  },
  {
    heading: "7. Data Retention",
    body: "We retain personal data for durations necessary to deliver services, fulfill legal, tax, audit, AML/CFT, and regulatory obligations, resolve disputes and enforce rights, and support fraud prevention investigations. Data no longer required is deleted, anonymized, or securely archived.",
  },
  {
    heading: "8. Security Controls",
    body: "21Tech applies administrative, technical, and organizational safeguards including access controls, encryption where appropriate, audit logging, and incident-response practices. No system is absolutely secure. Users should also protect their credentials and devices.",
  },
  {
    heading: "9. User Rights",
    body: "Subject to applicable law, you may request access to personal data, correction of inaccurate data, deletion where retention is no longer required, restriction or objection to certain processing, and withdrawal of consent where consent is legal basis. Requests can be sent to oro@romtech.bt",
  },
  {
    heading: "10. Restrictions",
    body: "Oro is not intended for persons which has no DK Bank Account. If person without DK Bank Account use is detected, 21Tech may suspend account access and take required compliance actions.",
  },
  {
    heading: "11. Policy Updates",
    body: "This Privacy Policy may be updated from time to time. Material changes will be notified via in-app notice or official communication channels. Updated versions take effect on posted effective date.",
  },
  {
    heading: "12. Contact",
    body: "For privacy requests, compliance inquiries, or complaints: Email oro@romtech.bt | Operator: 21Tech",
  },
];

type Tab = "terms" | "privacy";

export const TermsPage = ({ onBack }: { onBack?: () => void }) => {
  const [activeTab, setActiveTab] = useState<Tab>("terms");
  let navigate: (n: number) => void = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigate = useNavigate();
  } catch {
    // Not in a router context
  }

  const handleBack = onBack ?? (() => navigate(-1));

  const sections = activeTab === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main, #0f0f23)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "32px 16px 16px",
          borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted, #94a3b8)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 16,
            padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "var(--text-main, #f8fafc)",
            margin: 0,
            fontFamily: "var(--font-display)",
          }}
        >
          Terms & Privacy
        </h1>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-subtle, #64748b)",
            marginTop: 4,
          }}
        >
          Last updated May 2026
        </p>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            marginTop: 16,
            border: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setActiveTab("terms")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              background:
                activeTab === "terms"
                  ? "var(--text-main, #f8fafc)"
                  : "transparent",
              color:
                activeTab === "terms"
                  ? "var(--bg-main, #0f0f23)"
                  : "var(--text-muted, #94a3b8)",
            }}
          >
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
              background:
                activeTab === "privacy"
                  ? "var(--text-main, #f8fafc)"
                  : "transparent",
              color:
                activeTab === "privacy"
                  ? "var(--bg-main, #0f0f23)"
                  : "var(--text-muted, #94a3b8)",
            }}
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: "24px 16px",
          overflowY: "auto",
        }}
      >
        {sections.map((item) => (
          <div key={item.heading} style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-main, #f8fafc)",
                marginBottom: 4,
              }}
            >
              {item.heading}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted, #94a3b8)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

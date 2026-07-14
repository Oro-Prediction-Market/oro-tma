import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TERMS_SECTIONS = [
  {
    heading: "Acceptance of Terms",
    body: 'By creating an Account, clicking "I Agree," or otherwise accessing or using ORO, you confirm that you have read, understood, and agree to be bound by this Agreement in its entirety. If you do not agree to the Agreement, you must not create an Account or otherwise use ORO. If you are using ORO on behalf of an organization, you represent that you have authority to bind that organization, and "you" refers to both you individually and the organization.',
  },
  {
    heading: "1. Introduction",
    body: 'ORO is a collective intelligence and consensus forecasting platform operated by 21 Tech Gelephu Pte. Limited ("ORO," "we," "us," or "the Company"), a company incorporated in Gelephu Mindfulness City Authority (GMCA) and operating under the regulatory framework of the GMCA. ORO enables users to express probabilistic views on future events through structured prediction markets, and aggregates those views into consensus forecasts intended to surface distributed human knowledge. These Terms of Use, together with the Privacy Policy, Community Standards, Prediction Market Rules, Responsible Participation Policy, and any other policy referenced herein (collectively, the "Policies"), form a single binding agreement (the "Agreement") between ORO and each person who accesses or uses ORO (a "User" or "you").',
  },
  {
    heading: "2. Definitions",
    body: 'Account: the registered ORO profile through which a User accesses the Platform. Market: a structured question on ORO with defined possible Outcomes on which Users may take positions. Outcome: a possible resolution value of a Market, as defined in the Market\'s published rules. Wallet: the in-Platform ledger reflecting a User\'s balance of BTN and/or supported Digital Assets. BTN: the initial native unit of value supported for transactions on ORO. Digital Assets: BTN, stablecoins, or other blockchain-based assets ORO supports from time to time. Platform: the ORO website, mobile applications, APIs, and related services. GMCA: the Gelephu Mindfulness City Authority, the regulatory authority under which ORO operates. Collective Intelligence: the aggregation of individual User predictions into consensus forecasts. Prediction Market: a Market structured so that prices or aggregated positions reflect the collective probability Users assign to an Outcome.',
  },
  {
    heading: "3. Eligibility",
    body: "You must be at least 18 years old, or the age of legal majority in your jurisdiction if higher, to create an Account. You must have the legal capacity to enter into a binding agreement, and your use of ORO must be lawful under the laws applicable to you, including any laws governing prediction markets, gambling, or derivatives trading in your jurisdiction. You must not be a resident of, or accessing ORO from, any jurisdiction where prediction markets of the type ORO offers are prohibited, nor be subject to sanctions administered by the United Nations, GMCA, or any other authority applicable to ORO. ORO may restrict, suspend, or deny access to any person or jurisdiction at its discretion, including to comply with legal or regulatory requirements, and may request evidence of eligibility at any time.",
  },
  {
    heading: "4. Account Registration & Identity Verification (KYC)",
    body: 'You agree to provide accurate, current, and complete information during registration and to keep it up to date. ORO may require identity verification ("KYC"), source-of-funds information, and ongoing due diligence, consistent with our AML/CFT & KYC Policy, before permitting deposits, withdrawals, or participation in certain Markets. You are solely responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your Account — notify ORO immediately of any unauthorized use. One natural person or legal entity may hold only one Account, except where ORO expressly authorizes otherwise.',
  },
  {
    heading: "5. Platform Services",
    body: 'ORO provides access to prediction markets, consensus forecasting tools, research insights, and related features (the "Services"). ORO may add, modify, suspend, or discontinue any Service, in whole or in part, at any time, with notice where reasonably practicable. Availability of specific Markets, assets, or features may vary by jurisdiction based on applicable law.',
  },
  {
    heading: "6. Prediction Markets — How They Work",
    body: "Each Market specifies its question, possible Outcomes, resolution source(s), and resolution timeline at the time the Market is created, in accordance with the Prediction Market Rules. By taking a position in a Market, you accept that Market's specific rules as binding, in addition to this Agreement. Prices or odds within a Market reflect the aggregated positions of participating Users and are not guarantees, forecasts, or advice from ORO. ORO may set position limits, margin requirements, or other risk controls on any Market at its discretion.",
  },
  {
    heading: "7. Market Integrity & Prohibited Conduct",
    body: 'Users must not engage in, attempt, or facilitate: (a) market manipulation, including wash trading or coordinated positioning intended to distort a Market\'s price; (b) collusion between accounts; (c) use of material non-public information to gain an unfair advantage ("insider abuse"); (d) operation of undisclosed multiple accounts; (e) unauthorized automated trading, scraping, or bot activity; (f) fraud, identity misrepresentation, or circumvention of KYC controls; or (g) any activity unlawful in the applicable jurisdiction. ORO may investigate suspected violations, freeze affected positions or Wallet balances pending investigation, void or reprice affected Market positions, and suspend or terminate Accounts. ORO\'s determination of a violation, made reasonably and in accordance with its published policies, is final for purposes of internal Platform enforcement, without prejudice to a User\'s rights under Dispute Resolution.',
  },
  {
    heading: "8. Market Resolution & Settlement",
    body: "Markets resolve according to the resolution source(s) and methodology disclosed at Market creation, as further detailed in the Prediction Market Rules. Where a Market's resolution source is ambiguous, unavailable, or disputed, ORO will apply the Invalid Market and Appeals procedures. Settlement of Wallet balances following resolution will occur within the timeframe published for the relevant Market, subject to applicable KYC and withdrawal controls.",
  },
  {
    heading: "9. Fees & Wallets",
    body: "ORO may charge fees for Market creation, trading, withdrawals, or other Services. Current fees are published on the Platform and may change with reasonable prior notice. ORO initially supports BTN as its native transactional unit; support for additional Digital Assets or stablecoins will be governed by the Digital Asset Policy and does not require amendment of these Terms to take effect. Users are responsible for any taxes arising from their use of ORO.",
  },
  {
    heading: "10. Responsible Participation",
    body: "ORO provides voluntary tools including spending limits, cooling-off periods, and self-exclusion, as described in the Responsible Participation Policy. Users are encouraged to participate only with funds they can afford to risk and to treat Market participation as inherently uncertain. Users who believe they may be experiencing harm from their participation are encouraged to use self-exclusion tools and seek independent support; ORO's provision of these tools does not constitute medical or professional advice.",
  },
  {
    heading: "11. Risk Disclosure",
    body: "Participation in prediction markets involves risk of total loss of funds committed to a position. Past accuracy of consensus forecasts on ORO does not guarantee future accuracy. ORO does not provide investment, financial, legal, or tax advice — nothing on the Platform, including aggregated forecasts or AI-generated insights, should be treated as a recommendation to take any action. Digital Assets are volatile and subject to risks including price fluctuation, regulatory change, and technical failure; ORO is not responsible for losses arising from these risks.",
  },
  {
    heading: "12. AI & Collective Intelligence",
    body: "ORO may use artificial intelligence and machine learning tools to support market integrity monitoring, research, analytics, and consensus-forecast generation. AI-generated outputs are provided for informational purposes only and do not replace independent human judgment; ORO does not warrant the accuracy of AI-generated content. ORO applies bias-mitigation and human-oversight measures to AI systems materially affecting Users.",
  },
  {
    heading: "13. Intellectual Property",
    body: "All software, algorithms, interfaces, trademarks, and content comprising the Platform are owned by ORO or its licensors and protected by applicable intellectual property laws. ORO grants Users a limited, non-exclusive, non-transferable, revocable license to access and use the Platform for its intended purpose, subject to this Agreement. Users retain ownership of content they submit to the Platform (e.g., Market proposals, comments) but grant ORO a worldwide, royalty-free license to use, display, and process that content in connection with operating the Platform.",
  },
  {
    heading: "14. Privacy",
    body: "ORO processes personal information in accordance with the Privacy Policy, which forms part of this Agreement. Aggregated and anonymized platform data may be used for research, academic collaboration, and AI model improvement, in accordance with the Research & Data Governance Policy and applicable data protection law.",
  },
  {
    heading: "15. Suspension & Termination",
    body: "ORO may suspend or terminate an Account, with or without notice, where a User breaches this Agreement, engages in Prohibited Conduct, or where required by law or GMCA directive. Users may close their Account at any time, subject to settlement of open Market positions and any outstanding obligations. Sections of this Agreement that by their nature should survive termination — including Intellectual Property, Disclaimers, Limitation of Liability, and Governing Law — will survive.",
  },
  {
    heading: "16. Disclaimers",
    body: 'THE PLATFORM AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT, EXCEPT AS REQUIRED BY LAW. ORO does not guarantee that the Platform will be uninterrupted, secure, or error-free, or that any Market will resolve in a particular manner. ORO does not guarantee the accuracy, completeness, or timeliness of third-party data sources used for Market resolution.',
  },
  {
    heading: "17. Limitation of Liability & Indemnification",
    body: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, ORO WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE PLATFORM. ORO's aggregate liability arising from this Agreement will not exceed the greater of (a) the fees you paid to ORO in the twelve (12) months preceding the claim, or (b) the GMCA-equivalent minimum amount specified by applicable law, except where such limitation is unenforceable under mandatory law. You agree to indemnify and hold ORO harmless from claims, losses, or expenses (including reasonable legal fees) arising from your breach of this Agreement, your violation of law, or your Market participation.",
  },
  {
    heading: "18. Governing Law & Dispute Resolution",
    body: "This Agreement is governed by the laws and regulations applicable within the Gelephu Mindfulness City Authority, without regard to conflict-of-law principles, subject to any mandatory consumer-protection laws of your jurisdiction that cannot be contractually waived. Before initiating formal proceedings, the parties agree to attempt a good-faith resolution through ORO's internal support and appeals process for a period of 30 days. Unresolved disputes will be submitted to the dispute resolution mechanism designated under GMCA regulations, seated in Gelephu, Bhutan, conducted in English. Nothing in this section limits either party's right to seek injunctive relief in a court of competent jurisdiction for misuse of intellectual property or unauthorized access to the Platform.",
  },
  {
    heading: "19. Amendments",
    body: "ORO may amend this Agreement from time to time. Material changes will be notified via the Platform or email at least 14 days before taking effect, except where a shorter period is required by law or regulatory directive. Continued use of the Platform after an amendment takes effect constitutes acceptance of the revised Agreement. If you do not agree, you must stop using the Platform and may close your Account.",
  },
  {
    heading: "20. General Provisions",
    body: "Severability: if any provision of this Agreement is found unenforceable, the remaining provisions remain in full force. Assignment: Users may not assign or transfer their Account or rights under this Agreement without ORO's prior written consent; ORO may assign this Agreement in connection with a merger, acquisition, or sale of assets. Entire Agreement: this Agreement, together with the Policies it incorporates, constitutes the entire agreement between the parties regarding use of the Platform. No Waiver: ORO's failure to enforce any provision is not a waiver of its right to do so later. Force Majeure: ORO is not liable for delays or failures caused by events beyond its reasonable control.",
  },
  {
    heading: "21. Contact",
    body: "Legal notices: oro@21.tech.bt | General support: support@21.tech.bt | Registered address: 21 Tech Gelephu Pte. Limited.",
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
    body: "Subject to applicable law, you may request access to personal data, correction of inaccurate data, deletion where retention is no longer required, restriction or objection to certain processing, and withdrawal of consent where consent is legal basis. Requests can be sent to oro@21.tech.bt",
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
    body: "For privacy requests, compliance inquiries, or complaints: Email oro@21.tech.bt | Operator: 21Tech",
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
          Version 2.0 · Last updated July 2026
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

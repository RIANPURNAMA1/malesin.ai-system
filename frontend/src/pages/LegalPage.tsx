import { useLocation } from 'react-router-dom';

const APP_NAME = 'malesin.AI';
const COMPANY_NAME = 'PT Teknologi Riteck Indonesia';
const EMAIL = 'support@malesin.ai';
const DOMAIN = 'malesin.ai';

function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logoM.png" alt="" className="w-8 h-8 object-contain" />
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">Last updated: 19 June 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <p>
          This Privacy Policy explains how {APP_NAME} ("we," "our," or "us") collects, uses,
          stores, and protects your personal information when you use our platform and services,
          including any integrations with TikTok and other third-party platforms. By using {APP_NAME},
          you consent to the practices described in this policy.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
          <p>We may collect the following types of information when you use {APP_NAME}:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Account Information:</strong> Full name, email address, and profile photo provided during registration.</li>
            <li><strong>User ID:</strong> Unique identifier associated with your account on our Platform.</li>
            <li><strong>TikTok Account Data:</strong> Information obtained through TikTok Login Kit, including TikTok user ID, username, and profile picture, only after you grant explicit permission.</li>
            <li><strong>Technical Data:</strong> IP address, browser type and version, device information, operating system, and usage patterns.</li>
            <li><strong>Communication Data:</strong> Messages, inquiries, and correspondence you send to us.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. TikTok Data Access</h2>
          <p>
            {APP_NAME} integrates with TikTok through the official TikTok Developer Platform. We only access your
            TikTok data after you have explicitly provided consent through TikTok's authorization interface.
            The data we may access includes:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>TikTok User ID</li>
            <li>TikTok Username</li>
            <li>Profile Picture</li>
            <li>Basic account information as permitted by TikTok</li>
          </ul>
          <p className="mt-2">
            We do not access, collect, or store any data that you have not explicitly authorized. You can
            revoke {APP_NAME}'s access to your TikTok account at any time through your TikTok account settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Information</h2>
          <p>We use the collected information for the following purposes:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>To authenticate your identity and manage your account access.</li>
            <li>To display your TikTok account information when you choose to connect your account.</li>
            <li>To enable social media account linking and management features.</li>
            <li>To provide content management features, including posting and scheduling.</li>
            <li>To improve, personalize, and optimize your experience on the Platform.</li>
            <li>To communicate with you regarding service updates, support requests, and promotional materials (with your consent).</li>
            <li>To monitor and analyze usage trends to enhance our services.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Storage and Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your personal information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>All data transmitted between your device and our servers is encrypted using HTTPS protocol.</li>
            <li>Sensitive credentials are protected using industry-standard security mechanisms.</li>
            <li>Access to personal data is restricted to authorized personnel only, on a need-to-know basis for operational purposes.</li>
            <li>We regularly review and update our security practices to maintain data integrity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Sharing</h2>
          <p>
            We respect your privacy and do not sell your personal information to third parties.
            We may share your data only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>When required by law, regulation, or legal process (e.g., court order or government request).</li>
            <li>To enforce our Terms of Service or protect our rights, property, or safety.</li>
            <li>With trusted service providers who assist us in operating the Platform, under strict confidentiality agreements.</li>
            <li>With your explicit consent or at your direction.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. User Rights</h2>
          <p>You have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Right to Access:</strong> You can request a copy of the personal data we hold about you.</li>
            <li><strong>Right to Update:</strong> You can update or correct your personal information at any time through your account settings.</li>
            <li><strong>Right to Delete:</strong> You can request the deletion of your account and associated personal data.</li>
            <li><strong>Right to Revoke Access:</strong> You can disconnect your TikTok account from {APP_NAME} at any time.</li>
            <li><strong>Right to Withdraw Consent:</strong> You can withdraw your consent for data processing at any time, subject to legal limitations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Deletion Request</h2>
          <p>
            You may request the deletion of your personal data at any time. To submit a data deletion request,
            please contact us through one of the following channels:
          </p>
          <p className="mt-2">
            Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>
          </p>
          <p className="mt-2">
            Once we receive and verify your request, we will delete your personal data within 30 days, subject
            to any legal obligations that may require us to retain certain information. You will receive a
            confirmation once the deletion process is complete.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Third-Party Services</h2>
          <p>
            {APP_NAME} integrates with various third-party platforms to provide its services. Each of these
            platforms has its own privacy policies and terms of service:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>TikTok — Data handling is governed by TikTok's Privacy Policy.</li>
            <li>Meta / Facebook — Data handling is governed by Meta's Privacy Policy.</li>
            <li>Instagram — Data handling is governed by Instagram's Privacy Policy.</li>
            <li>WhatsApp — Data handling is governed by WhatsApp's Privacy Policy.</li>
            <li>Google — Data handling is governed by Google's Privacy Policy.</li>
          </ul>
          <p className="mt-2">
            We encourage you to review the privacy policies of these third-party services before connecting
            them to {APP_NAME}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact Information</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
            please contact us:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></li>
            <li>Website: <a href={`https://${DOMAIN}`} className="text-primary hover:underline">https://{DOMAIN}</a></li>
            <li>Company: {COMPANY_NAME}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logoM.png" alt="" className="w-8 h-8 object-contain" />
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">Last updated: 19 June 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <p>
          These Terms of Service govern your use of the {APP_NAME} platform, including any integrations
          with TikTok and other third-party services. By accessing or using {APP_NAME}, you agree to be
          bound by these terms.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p>
            By creating an account, accessing, or using {APP_NAME} ("the Platform"), you acknowledge that
            you have read, understood, and agree to be bound by these Terms of Service and all applicable
            laws and regulations. If you do not agree with any part of these terms, you must not use the
            Platform. These terms constitute a legally binding agreement between you and {COMPANY_NAME},
            the company behind {APP_NAME}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. User Responsibilities</h2>
          <p>As a user of {APP_NAME}, you are responsible for:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Maintaining the confidentiality and security of your account credentials.</li>
            <li>All content created, published, or transmitted through your account on the Platform.</li>
            <li>Complying with TikTok's terms of service, community guidelines, and any other platform policies applicable to connected services.</li>
            <li>Ensuring the security of your TikTok account credentials and any other third-party accounts linked to {APP_NAME}.</li>
            <li>Providing accurate, current, and complete information during the registration process.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. TikTok Integration</h2>
          <p>
            {APP_NAME} offers optional integration with TikTok through TikTok Login Kit and other official
            TikTok Developer Platform services. By connecting your TikTok account, you authorize {APP_NAME}
            to access specific data and perform actions on your behalf only after you have explicitly granted
            permission through TikTok's consent interface. {APP_NAME} will only access data that you have
            authorized, including but not limited to your TikTok user ID, username, and profile information.
            You may revoke {APP_NAME}'s access to your TikTok account at any time through your TikTok settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Prohibited Activities</h2>
          <p>You agree not to engage in any of the following prohibited activities:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Misusing the Platform for any unlawful purpose or in violation of any applicable laws or regulations.</li>
            <li>Engaging in illegal activities, including but not limited to fraud, money laundering, or intellectual property infringement.</li>
            <li>Sending spam, unsolicited messages, or engaging in any form of abusive messaging through the Platform.</li>
            <li>Scraping, crawling, or harvesting data from the Platform without prior written authorization.</li>
            <li>Violating TikTok's terms of service, community guidelines, or any other third-party platform policies.</li>
            <li>Attempting to reverse engineer, decompile, or disassemble any part of the Platform.</li>
            <li>Using the Platform to distribute malware, viruses, or any other harmful code.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Disclaimer</h2>
          <p>
            The Platform is provided on an "as is" and "as available" basis without any warranties of any
            kind, either express or implied. {APP_NAME} does not guarantee that:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>The service will be uninterrupted, timely, secure, or error-free.</li>
            <li>The results obtained from using the Platform will be accurate or reliable.</li>
            <li>Any errors or defects will be corrected.</li>
          </ul>
          <p className="mt-2">
            {APP_NAME} shall not be liable for any changes in policies, terms, or API availability of third-party
            services, including TikTok, Meta, or any other integrated platform. Your use of third-party services
            is subject to their respective terms and policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Account Termination</h2>
          <p>
            {APP_NAME} reserves the right to suspend or terminate your account at any time without prior notice
            if you violate these Terms of Service or engage in any prohibited activities. Upon termination, your
            access to the Platform will cease immediately, and {APP_NAME} may delete your data in accordance with
            our Privacy Policy. You may also delete your account at any time through your account settings or by
            contacting our support team.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact Information</h2>
          <p>If you have any questions, concerns, or requests regarding these Terms of Service, please contact us:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></li>
            <li>Website: <a href={`https://${DOMAIN}`} className="text-primary hover:underline">https://{DOMAIN}</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to {APP_NAME}
        </a>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          {isPrivacy ? <PrivacyPolicy /> : <TermsOfService />}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  );
}

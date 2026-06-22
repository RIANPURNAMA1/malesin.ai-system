import { useLocation } from 'react-router-dom';

const APP_NAME = 'Malesan.AI';
const COMPANY_NAME = 'Malesan.AI';
const EMAIL = 'support@malesan.ai';
const DOMAIN = 'malesan.ai';

function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 19, 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <p>
          This Privacy Policy describes how {COMPANY_NAME} ("we", "us", or "our") collects,
          uses, and discloses your information when you use our platform and services.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, including:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Account registration information (name, email, company name)</li>
            <li>Profile information (avatar, phone number)</li>
            <li>Communication data (messages, conversations, media files)</li>
            <li>Payment and billing information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide, maintain, and improve our services</li>
            <li>To process transactions and send related information</li>
            <li>To send technical notices, updates, security alerts, and support messages</li>
            <li>To respond to your comments, questions, and requests</li>
            <li>To monitor and analyze trends, usage, and activities</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Data Sharing and Disclosure</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Service providers who perform services on our behalf</li>
            <li>Business partners with your consent or as necessary to provide services</li>
            <li>Law enforcement or other third parties when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security measures to protect
            your information. However, no method of transmission or storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access, update, or delete your personal information</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.
          </p>
        </section>
      </div>
    </div>
  );
}

function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 19, 2026</p>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <p>
          By accessing or using the {APP_NAME} platform, you agree to be bound by these Terms of Service.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Account Registration</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the confidentiality of your login credentials</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>You must be at least 18 years old to use this service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Use the service for any unlawful purpose or in violation of any laws</li>
            <li>Send spam, unsolicited messages, or harass other users</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the integrity of the service</li>
            <li>Use the service to transmit malware or harmful code</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Service Availability</h2>
          <p>
            We strive to provide uninterrupted service but do not guarantee 100% availability.
            We reserve the right to modify, suspend, or discontinue the service at any time
            with reasonable notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Limitation of Liability</h2>
          <p>
            {COMPANY_NAME} shall not be liable for any indirect, incidental, special, consequential,
            or punitive damages arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Termination</h2>
          <p>
            We may terminate or suspend your account at any time for violation of these terms
            or for any other reason with prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Changes to Terms</h2>
          <p>
            We reserve the right to update these terms at any time. We will notify users of
            material changes via email or through the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
          <p>
            For questions about these terms, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.
          </p>
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

import Head from "next/head";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy · Luxora</title>
        <meta
          name="description"
          content="How Luxora collects, uses, and protects your personal information."
        />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <p>
            Your privacy matters to us. This Privacy Policy explains what
            information we collect when you use Luxora, how we use it, and the
            choices you have.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Information we collect
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Account details such as name, email, and phone number</li>
              <li>
                Order details including shipping address and items purchased
              </li>
              <li>
                Payment method metadata (processed securely by our payment
                partners)
              </li>
              <li>
                Device and usage data (IP, browser, pages viewed) for security
                and analytics
              </li>
              <li>
                Cookies and similar technologies (see our{" "}
                <Link
                  href="/policies/cookies"
                  className="underline text-purple-600"
                >
                  Cookies Policy
                </Link>
                )
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              How we use your information
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Process and fulfill your orders</li>
              <li>Provide customer support and resolve issues</li>
              <li>Improve our products, services, and user experience</li>
              <li>Personalize content and recommendations</li>
              <li>Detect, prevent, and address fraud or security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Sharing of information
            </h2>
            <p className="mt-2">
              We do not sell your personal data. We may share limited
              information with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Service providers (payment, delivery, email) to operate our
                services
              </li>
              <li>Authorities when required by law or to protect our rights</li>
              <li>
                In the context of a business transaction (e.g., merger or
                acquisition)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Data retention
            </h2>
            <p className="mt-2">
              We retain data for as long as necessary to provide the service and
              comply with legal obligations. You can request deletion of your
              account data, subject to exceptions (e.g., fraud prevention,
              tax/regulatory requirements).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Your rights</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access, correct, or delete your personal information</li>
              <li>Object to or restrict certain processing</li>
              <li>Opt out of marketing communications</li>
              <li>Port your data, where applicable</li>
            </ul>
            <p className="mt-2">
              To exercise your rights, contact{" "}
              <a
                href="mailto:support@luxora.com"
                className="underline text-purple-600"
              >
                support@luxora.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Changes</h2>
            <p className="mt-2">
              We may update this policy from time to time. Material changes will
              be posted on this page.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

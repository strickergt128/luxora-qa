import Head from "next/head";
import Link from "next/link";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms of Service · Luxora</title>
        <meta name="description" content="Luxora Terms of Service." />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <p>
            By accessing or using Luxora, you agree to these Terms. If you do
            not agree, please do not use the service.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Accounts</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                You are responsible for safeguarding your account credentials.
              </li>
              <li>
                You must provide accurate information and keep it up to date.
              </li>
              <li>
                You must be at least 18 or have consent from a legal guardian.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Orders & payment
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Placing an order is an offer to buy; we may accept or cancel at
                our discretion.
              </li>
              <li>
                Pricing, promotions, and availability are subject to change
                without notice.
              </li>
              <li>Taxes, fees, and shipping costs are shown at checkout.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Shipping & returns
            </h2>
            <p className="mt-2">
              See our{" "}
              <Link
                href="/policies/shipping"
                className="underline text-purple-600"
              >
                Shipping Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/policies/returns"
                className="underline text-purple-600"
              >
                Returns
              </Link>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              User content
            </h2>
            <p className="mt-2">
              By posting reviews or other content, you grant us a non-exclusive,
              royalty-free license to use, display, and distribute such content
              on Luxora. You are responsible for ensuring you have the rights to
              post it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Prohibited uses
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Breaking the law or infringing intellectual property rights
              </li>
              <li>Attempting to disrupt or compromise the platform</li>
              <li>Abusive, deceptive, or fraudulent activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Limitation of liability
            </h2>
            <p className="mt-2">
              To the fullest extent permitted by law, Luxora is not liable for
              indirect, incidental, or consequential damages arising from your
              use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Changes</h2>
            <p className="mt-2">
              We may modify these Terms at any time. Continued use of Luxora
              means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Contact</h2>
            <p className="mt-2">
              Questions about these Terms? Contact{" "}
              <a
                href="mailto:support@luxora.com"
                className="underline text-purple-600"
              >
                support@luxora.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

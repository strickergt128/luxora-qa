import Head from "next/head";

export default function CookiesPolicyPage() {
  return (
    <>
      <Head>
        <title>Cookies Policy · Luxora</title>
        <meta
          name="description"
          content="How Luxora uses cookies and similar technologies."
        />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Cookies Policy</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              What are cookies?
            </h2>
            <p className="mt-2">
              Cookies are small text files stored on your device to help
              websites function and improve your experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              How we use cookies
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Authentication and session management</li>
              <li>Preferences (e.g., language)</li>
              <li>Analytics to understand usage and improve the site</li>
              <li>Fraud prevention and security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Managing cookies
            </h2>
            <p className="mt-2">
              You can control cookies in your browser settings. Disabling
              cookies may affect site functionality.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

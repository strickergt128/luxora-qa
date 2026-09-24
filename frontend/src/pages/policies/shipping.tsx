import Head from "next/head";

export default function ShippingPolicyPage() {
  return (
    <>
      <Head>
        <title>Shipping Policy · Luxora</title>
        <meta name="description" content="Luxora Shipping Policy." />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Shipping Policy</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Processing times
            </h2>
            <p className="mt-2">
              Orders are typically processed within 1-2 business days. During
              high demand or holidays, processing may take longer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Methods & fees
            </h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Standard: 4-7 business days (may be free)</li>
              <li>Express: 1-2 business days (additional fee)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Tracking</h2>
            <p className="mt-2">
              When available, tracking details will be provided via email after
              shipment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Delivery areas
            </h2>
            <p className="mt-2">
              We currently ship to only in India. If your address is not
              supported, you will be notified at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Failed delivery
            </h2>
            <p className="mt-2">
              Please ensure your address and phone number are accurate. If a
              delivery fails due to incorrect details or missed attempts,
              additional charges or order cancellation may apply.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

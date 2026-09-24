import Head from "next/head";

export default function PaymentsPolicyPage() {
  return (
    <>
      <Head>
        <title>Payments · Luxora</title>
        <meta
          name="description"
          content="Payments information for Luxora orders."
        />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Accepted methods
            </h2>
            <p className="mt-2">
              We currently support Cash on Delivery (COD) where available.
              Additional payment methods may be introduced over time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Payment security
            </h2>
            <p className="mt-2">
              Payments are processed by trusted providers using
              industry-standard encryption. We do not store full card details on
              our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Failed or cancelled payments
            </h2>
            <p className="mt-2">
              If a payment fails or an order is cancelled, any pending
              authorizations are typically released by your bank within a few
              business days.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

import Head from "next/head";

export default function ReturnsPolicyPage() {
  return (
    <>
      <Head>
        <title>Returns · Luxora</title>
        <meta name="description" content="Luxora Returns policy." />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Returns</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: September 2025
        </p>

        <div className="mt-6 space-y-6 text-gray-800">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Return window
            </h2>
            <p className="mt-2">
              You can request a return within 1-7 days from delivery, unless
              specified otherwise on the product page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Eligibility</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Items must be unused and in original packaging</li>
              <li>Include all accessories, manuals, and freebies</li>
              <li>Proof of purchase (order ID) is required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              Non-returnable items
            </h2>
            <p className="mt-2">
              Certain items may be ineligible due to hygiene, perishability, or
              customization. Check the product page for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Refunds</h2>
            <p className="mt-2">
              After inspection, approved returns are refunded to the original
              payment method. Processing time may vary by provider.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              How to start a return
            </h2>
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Go to Orders and select the item you want to return</li>
              <li>Choose a reason and submit your request</li>
              <li>Follow the instructions for pickup or drop-off</li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

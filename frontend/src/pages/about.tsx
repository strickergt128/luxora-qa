import Head from "next/head";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us · Luxora</title>
        <meta
          name="description"
          content="Learn about Luxora — our mission, values, and the experience we want to deliver."
        />
      </Head>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="surface-card p-8 md:p-12">
          <div className="border-b border-border pb-6 mb-8 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              About Luxora
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Verified products, clear pricing, and delivery updates from checkout to doorstep.
            </p>
          </div>

          <div className="space-y-10 text-foreground">
            <section className="rounded-xl border border-primary/40 bg-primary/10 p-6">
              <h2 className="mb-4 text-2xl font-bold text-foreground">
                What we do
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Luxora helps shoppers compare products, buy with confidence, and track orders without extra steps.
              </p>
            </section>

            <section className="grid md:grid-cols-2 gap-8">
              <div className="card p-6">
                <h2 className="mb-4 border-b border-border pb-4 text-2xl font-bold text-foreground">
                  For shoppers
                </h2>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    Find in-stock products with clear prices and seller details.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    Save items, review ratings, and checkout securely.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    Get order updates and delivery information after purchase.
                  </li>
                </ul>
              </div>

              <div className="card p-6">
                <h2 className="mb-4 border-b border-border pb-4 text-2xl font-bold text-foreground">
                  For sellers
                </h2>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
                    List products, manage inventory, and process orders from one dashboard.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
                    Track sales, customer messages, and fulfillment status.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
                    Build trust with accurate stock, reviews, and support.
                  </li>
                </ul>
              </div>
            </section>

            <section className="border-t border-border pt-8 text-center text-sm">
              <p className="mb-4 text-muted-foreground">Need help with an order or seller account?</p>
              <Link
                href="/contact"
                className="btn-primary inline-block px-8 py-3"
              >
                Contact support
              </Link>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

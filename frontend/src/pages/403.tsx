export default function NotAuthorized() {
  return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Not authorized</h1>
      <p className="text-gray-600 mt-2">
        You don’t have permission to view this page.
      </p>
      <a
        href="/"
        className="inline-block mt-6 px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-500"
      >
        Go to Home
      </a>
    </div>
  );
}

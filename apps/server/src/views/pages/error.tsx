import { Layout } from "../layout";

export function ErrorPage({ status, message }: { status: number; message: string }) {
  const title = status === 404 ? "Page not found" : status >= 500 ? "Server error" : "Request failed";
  return (
    <Layout title={title}>
      <section class="error-page">
        <h1>{title}</h1>
        <p safe>{message}</p>
        <p>
          <a href="/">Go to the start page</a>
        </p>
      </section>
    </Layout>
  );
}

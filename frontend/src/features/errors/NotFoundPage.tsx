import { LinkButton } from "@/components/ui/LinkButton";
import { paths } from "@/lib/routes";

/** Unknown URL inside the signed-in app. */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The page you are looking for does not exist or has moved.
      </p>
      <LinkButton to={paths.home} variant="primary" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}

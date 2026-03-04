"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Conflict Checking System
        </h1>
        <p className="text-lg text-gray-600 mb-8 text-center max-w-2xl">
          Integrated legal conflict checking powered by fuzzy matching,
          corporate family tree traversal, and immutable audit trails.
        </p>
        <p className="text-gray-500">
          Sign in with your Microsoft account to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Conflict Search"
          description="Run fuzzy name searches across all entities, matters, and corporate families."
          href="/search"
          color="blue"
        />
        <DashboardCard
          title="Lateral Hire Import"
          description="Import conflicts data from lateral partner questionnaires and prior-firm exports."
          href="/lateral-import"
          color="green"
        />
        <DashboardCard
          title="Ethical Walls"
          description="Manage attorney screening with database-enforced access restrictions."
          href="/ethical-walls"
          color="red"
        />
        <DashboardCard
          title="Audit Trail"
          description="Review immutable search history, dispositions, and compliance documentation."
          href="/audit"
          color="purple"
        />
        <DashboardCard
          title="Admin Settings"
          description="Configure fuzzy matching weights, thresholds, and common-name suppressions."
          href="/admin"
          color="gray"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
  color,
}: {
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "border-l-blue-500 hover:bg-blue-50",
    green: "border-l-green-500 hover:bg-green-50",
    red: "border-l-red-500 hover:bg-red-50",
    purple: "border-l-purple-500 hover:bg-purple-50",
    gray: "border-l-gray-500 hover:bg-gray-50",
  };

  return (
    <Link
      href={href}
      className={`block p-6 bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${colorClasses[color]} transition-colors`}
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}

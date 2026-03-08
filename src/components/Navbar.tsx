"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "New Check" },
  { href: "/search", label: "Quick Search" },
  { href: "/import", label: "Import" },
  { href: "/ethical-walls", label: "Ethical Walls" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/staff-lookup", label: "Staff Lookup" },
  { href: "/admin", label: "Admin" },
];

function navigate(href: string) {
  window.location.href = href;
}

export function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <a href="/" onClick={() => navigate("/")} className="text-xl font-bold text-primary-700">
              Conflicts
            </a>
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href + label}
                href={href}
                onClick={() => navigate(href)}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                {label}
              </a>
            ))}
            <a
              href="/help"
              onClick={() => navigate("/help")}
              className="text-gray-400 hover:text-gray-600 px-2 py-2 text-sm"
              title="Help & Glossary"
            >
              ?
            </a>
          </div>
          <div className="flex items-center">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  <span>{session.user?.name}</span>
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                    {(session.user as Record<string, string>)?.role ?? "readonly"}
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => signIn("azure-ad")}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
              >
                Sign in with Microsoft
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

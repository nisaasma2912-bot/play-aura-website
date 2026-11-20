import type { MouseEvent } from 'react';
import type { ActiveView } from '../types/game';

const LOGO_SRC = '/assets/aistudio/5bc4cd61-25ef-4236-a8bc-50f736f5221a_ba0fcba2.png';

interface FooterProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}

const FOOTER_LINKS: Array<{ view: ActiveView; href: string; label: string }> = [
  { view: 'about', href: '/about', label: 'About Us' },
  { view: 'privacy-policy', href: '/privacy-policy', label: 'Privacy Policy' },
  { view: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { view: 'disclaimer', href: '/disclaimer', label: 'Disclaimer' },
  { view: 'contact', href: '/contact', label: 'Contact Us' },
];

export function Footer({ activeView, onNavigate }: FooterProps) {
  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, view: ActiveView) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(view);
  };

  return (
    <footer className="relative z-10 border-t border-[#CBE7FA]/80 bg-white/92 backdrop-blur-md py-8 px-4 sm:px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Play Aura Brand & Short Description */}
          <div className="flex items-start sm:items-center gap-3 max-w-md">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, 'home')}
              className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5] rounded-xl"
              aria-label="Play Aura home"
            >
              <img
                src={LOGO_SRC}
                alt="Play Aura logo"
                width={1536}
                height={1024}
                decoding="async"
                className="h-10 sm:h-11 w-auto object-contain shrink-0 select-none"
              />
            </a>
            <div>
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, 'home')}
                className="font-display text-lg font-bold text-[#2B3445] hover:text-[#1D6B52] transition-colors"
              >
                Play Aura
              </a>
              <p className="text-xs sm:text-sm font-semibold text-[#5A657A] mt-0.5 leading-relaxed">
                A cheerful playground where you can play games instantly
              </p>
            </div>
          </div>

          {/* Information & Legal Links */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm font-bold text-[#5A657A]"
          >
            {FOOTER_LINKS.map((item) => {
              const isActive = activeView === item.view;
              return (
                <a
                  key={item.view}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.view)}
                  className={`whitespace-nowrap py-1 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8AD8B5] rounded-sm ${
                    isActive
                      ? 'text-[#1D6B52] border-[#8AD8B5]'
                      : 'border-transparent hover:text-[#1D6B52] hover:border-[#CBE7FA]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-[#EAE3CE]/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold text-[#5A657A]">
          <p>© 2026 Play Aura. All Rights Reserved.</p>
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, 'home')}
            className="hover:text-[#1D6B52] transition-colors"
          >
            Back to Games
          </a>
        </div>
      </div>
    </footer>
  );
}


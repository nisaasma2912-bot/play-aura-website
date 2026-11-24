import type { MouseEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ActiveView } from '../types/game';

interface InfoPageProps {
  view: Exclude<ActiveView, 'home' | 'admin'>;
  onNavigate: (view: ActiveView) => void;
  onOpenCookieSettings?: () => void;
}

const CONTACT_EMAIL = '123playaura@gmail.com';

const RELATED_PAGES: Array<{ view: Exclude<ActiveView, 'home' | 'admin'>; href: string; label: string }> = [
  { view: 'about', href: '/about', label: 'About Us' },
  { view: 'privacy-policy', href: '/privacy-policy', label: 'Privacy Policy' },
  { view: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { view: 'disclaimer', href: '/disclaimer', label: 'Disclaimer' },
  { view: 'contact', href: '/contact', label: 'Contact Us' },
];

export function InfoPage({ view, onNavigate, onOpenCookieSettings }: InfoPageProps) {
  const handleLink = (e: MouseEvent<HTMLAnchorElement>, target: ActiveView) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(target);
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-5">
        <a
          href="/"
          onClick={(e) => handleLink(e, 'home')}
          className="bubble-button inline-flex items-center gap-2 rounded-full bg-white hover:bg-[#D8F3E5] border-2 border-[#CBE7FA] hover:border-[#8AD8B5] text-[#2B3445] hover:text-[#1D6B52] px-5 py-2.5 text-sm font-bold bubble-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8AD8B5]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Play Aura Games</span>
        </a>
      </div>

      <article className="rounded-[32px] bg-white border-2 border-[#CBE7FA] p-6 sm:p-10 bubble-shadow space-y-6">
        {view === 'privacy-policy' && (
          <PrivacyPolicyContent onOpenCookieSettings={onOpenCookieSettings} />
        )}
        {view === 'terms' && <TermsContent />}
        {view === 'about' && <AboutContent onNavigate={onNavigate} />}
        {view === 'contact' && <ContactContent />}
        {view === 'disclaimer' && <DisclaimerContent />}

        {/* Links to Other Relevant Pages */}
        <div className="pt-6 border-t border-[#EAE3CE]">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#5A657A] mb-3">
            More Information
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
            {RELATED_PAGES.filter((p) => p.view !== view).map((page) => (
              <a
                key={page.view}
                href={page.href}
                onClick={(e) => handleLink(e, page.view)}
                className="text-[#1E5B8A] hover:text-[#1D6B52] underline decoration-[#CBE7FA] underline-offset-4 transition-colors"
              >
                {page.label}
              </a>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

function PrivacyPolicyContent({ onOpenCookieSettings }: { onOpenCookieSettings?: () => void }) {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          Privacy Policy
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          Last updated: November 21, 2026
        </p>
      </header>

      <p className="text-base text-[#5A657A]">
        Play Aura respects your privacy. This Privacy Policy explains what information is collected or processed by Play Aura and our technical service providers when you visit{' '}
        <span className="font-semibold text-[#2B3445]">https://play-aura-website.pages.dev/</span>, play browser games, or submit a game suggestion.
      </p>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">1. Information Collected</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          You can browse and play games on Play Aura without registering an account. However, standard website analytics, hosting infrastructure, and optional features collect or process the following categories of data:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong>Google Analytics 4 Usage Data:</strong> Page visits, browser and device characteristics, approximate geographic region derived from IP processing, referral sources, and game player interactions (specifically when a game is opened or closed, along with the game name and identifier).
          </li>
          <li>
            <strong>Technical Server &amp; Network Data:</strong> Our hosting and database providers automatically log standard HTTP request details (such as IP address, user-agent, requested URL, and timestamps) to serve pages securely and prevent abuse.
          </li>
          <li>
            <strong>Game Suggestions:</strong> When you voluntarily send an idea through the Game Suggestion box, we store your suggestion text, a one-way SHA-256 hash of a random browser token, timestamp, and moderation status. We ask visitors not to enter personal contact details in suggestions.
          </li>
          <li>
            <strong>Direct Email Correspondence:</strong> If you email us at {CONTACT_EMAIL}, we receive your email address and the message you send.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          2. Google Analytics 4 &amp; Analytics Cookies
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura uses <strong>Google Analytics 4</strong> (Measurement ID <code className="font-mono text-xs bg-[#FAF5E8] px-1.5 py-0.5 rounded">G-1FN81T0SYK</code>), an analytics service provided by Google, to understand overall traffic patterns and see which games visitors open and enjoy. Google Analytics uses cookies and similar browser identifiers (such as <code className="font-mono text-xs bg-[#FAF5E8] px-1.5 py-0.5 rounded">_ga</code>) to distinguish browser sessions and measure interactions.
        </p>
        <p className="text-sm sm:text-base text-[#5A657A]">
          We use Google Analytics strictly to measure website performance and game popularity—not to serve targeted advertisements.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          3. Advertising &amp; Optional AdSense Integration
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          <strong>Google AdSense is currently not active</strong> on Play Aura and is not serving advertisements unless explicitly enabled by the site owner. Google Analytics (analytics measurement) and Google AdSense (advertising) are separate services.
        </p>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If advertising is enabled on Play Aura in the future, third-party vendors, including Google, may use cookies to serve ads based on a visitor&apos;s prior visits to this website or other websites, subject to applicable regional consent requirements and this Privacy Policy.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          4. How Information Is Used
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>To deliver games, pages, and static assets reliably across desktop and mobile devices.</li>
          <li>To measure aggregate site visits and game open/close interactions so we can improve the game collection and layout.</li>
          <li>To prevent spam, rate-limit repeated submissions, and enforce visitor blocks on the Game Suggestion feature.</li>
          <li>To respond to user questions, technical bug reports, privacy requests, or copyright notices.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          5. Browser Local Storage &amp; Third-Party Services
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura uses browser <code className="font-mono text-xs bg-[#FAF5E8] px-1.5 py-0.5 rounded">localStorage</code> for essential functionality and preferences: saving your cookie preference choice, rate-limiting and securing game suggestions with an anonymous random token, and keeping authorized site administrators signed in.
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong>Google Analytics 4:</strong> Website traffic and game interaction measurement.
          </li>
          <li>
            <strong>Cloudflare Pages:</strong> Static hosting, edge caching, and security delivery.
          </li>
          <li>
            <strong>Supabase:</strong> Database and file storage for hosted browser games, thumbnails, admin authentication, and game suggestion moderation.
          </li>
          <li>
            <strong>Google Fonts:</strong> Serves web typography stylesheets and font files.
          </li>
          <li>
            <strong>YouTube External Link:</strong> The header YouTube icon links externally to our YouTube channel, which operates under Google/YouTube&apos;s privacy policy.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          6. Google Partner Data Disclosure &amp; Ad Choices
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          You can review how Google uses information from sites or apps that use its services, and manage Google or industry ad personalization settings, through these official resources:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong>How Google uses data on partner sites:</strong>{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1D6B52] underline underline-offset-4 break-all"
            >
              https://policies.google.com/technologies/partner-sites
            </a>
          </li>
          <li>
            <strong>Google Ads Settings:</strong>{' '}
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1D6B52] underline underline-offset-4 break-all"
            >
              https://adssettings.google.com/
            </a>
          </li>
          <li>
            <strong>About Ads (Digital Advertising Alliance opt-out):</strong>{' '}
            <a
              href="https://www.aboutads.info/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1D6B52] underline underline-offset-4 break-all"
            >
              https://www.aboutads.info/
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          7. Data Retention &amp; Your Privacy Choices
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Game suggestions are retained only as long as needed to review community ideas and maintain spam/block moderation. Administrators can delete suggestions and remove visitor blocks from the Admin dashboard. Google Analytics data retention is governed by the site&apos;s Google Analytics property retention settings.
        </p>
        <p className="text-sm sm:text-base text-[#5A657A]">
          You can block or delete cookies at any time through your browser settings, clear site storage to reset local anonymous tokens, or update your analytics preference on Play Aura using the button below.
        </p>
        {onOpenCookieSettings && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenCookieSettings}
              className="bubble-button rounded-full bg-[#DDF0FC] hover:bg-[#CBE7FA] text-[#1E5B8A] px-5 py-2.5 text-sm font-bold cursor-pointer"
            >
              Manage Cookie Preferences
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">8. Contact Us About Privacy</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you have privacy questions or would like to request removal of a suggestion you submitted, please contact Play Aura at{' '}
          <span className="font-bold text-[#1D6B52]">{CONTACT_EMAIL}</span>.
        </p>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          Terms of Use &amp; Conditions
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          Last updated: November 21, 2026
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">1. Acceptance &amp; Acceptable Use</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          By visiting or playing games on Play Aura, you agree to use the website lawfully, respectfully, and solely for personal, non-commercial browser entertainment. If you do not agree with these terms, please stop using the website.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">2. Game Availability &amp; Maintenance</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Games, instructions, and website features may be updated, paused, replaced, or removed at any time without prior notice, and individual games may perform differently depending on your browser or device.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          3. Third-Party Game Content &amp; Intellectual Property
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura&apos;s name, layout, and original site interface elements belong to Play Aura. Games featured or hosted on the platform may be owned by third-party developers, creators, or publishers. Play Aura does not claim ownership over third-party games, trademarks, logos, artwork, music, sound effects, or code; all such intellectual property remains with its respective owners.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          4. External Links &amp; Third-Party Services
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura uses third-party infrastructure (including Cloudflare Pages, Supabase, Google Fonts, and Google Analytics) and provides an external link to our YouTube channel. We are not responsible for the content, availability, or privacy practices of external websites or services.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          5. User Responsibilities &amp; Suggestion Rules
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>Do not attempt to disrupt gameplay, probe vulnerabilities, scrape content abusively, or gain unauthorized access to the Admin dashboard or database.</li>
          <li>Do not send automated spam, promotional links, harmful payloads, or personal contact details (such as names, emails, or phone numbers) through the Game Suggestion box.</li>
          <li>Play Aura may moderate, archive, or delete suggestions and block anonymous visitor identifiers linked to spam or abuse.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          6. Copyright &amp; Content Removal Contact
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you are a copyright holder or authorized agent and believe any game or material on Play Aura infringes your rights, please contact us at{' '}
          <span className="font-bold text-[#1D6B52]">{CONTACT_EMAIL}</span> with the game title and details so we can review and address the request promptly.
        </p>
      </section>
    </div>
  );
}

function AboutContent({ onNavigate }: { onNavigate: (view: ActiveView) => void }) {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          About Play Aura
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          A calm, cheerful online gaming playground right in your browser
        </p>
      </header>

      <section className="space-y-3 text-sm sm:text-base text-[#5A657A]">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B3445]">
          What Play Aura Is
        </h2>
        <p>
          <strong className="text-[#2B3445]">Play Aura</strong> is an online browser games website created to make finding and playing web games effortless, friendly, and instant. You do not need to download apps, install plugins, or sign up for a player account to enjoy the site.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base text-[#5A657A]">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B3445]">
          How to Browse and Play Games
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-[#2B3445]">Browse &amp; Search:</strong> Scroll through the game cards on the homepage or type a title into the search bar to filter available games right away.
          </li>
          <li>
            <strong className="text-[#2B3445]">Open &amp; Play Instantly:</strong> Click any game card or its <em>Play Now</em> button to open the game directly inside the Play Aura game player.
          </li>
          <li>
            <strong className="text-[#2B3445]">Player Controls &amp; Details:</strong> Use the top player bar to restart a game, switch to fullscreen, or return to the catalog, and scroll down below the game window to read game descriptions, objectives, and controls when provided.
          </li>
          <li>
            <strong className="text-[#2B3445]">Share Game Ideas:</strong> Click the Suggestion icon in the header to send ideas for genres or games you would love to play on Play Aura, or visit our YouTube channel from the header.
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm sm:text-base text-[#5A657A]">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B3445]">
          Gaming Experience
        </h2>
        <p>
          Play Aura focuses on a bright pastel interface that keeps navigation clutter-free and works comfortably across desktop monitors, tablets, and mobile phones.
        </p>
      </section>

      <section className="space-y-2 text-sm sm:text-base text-[#5A657A]">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B3445]">
          Get in Touch
        </h2>
        <p>
          Questions, feedback, or copyright inquiries can be sent to{' '}
          <span className="font-bold text-[#1D6B52]">{CONTACT_EMAIL}</span>, or you can view more details on our{' '}
          <a
            href="/contact"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate('contact');
            }}
            className="font-bold text-[#1E5B8A] underline underline-offset-4"
          >
            Contact Us
          </a>{' '}
          page.
        </p>
      </section>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          Contact Us
        </h1>
        <p className="text-sm sm:text-base font-semibold text-[#5A657A]">
          We welcome questions, website feedback, and copyright or privacy inquiries.
        </p>
      </header>

      <div className="rounded-[24px] bg-[#D8F3E5]/55 border-2 border-[#BFEAD6] p-5 sm:p-6">
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#1D6B52]">
          Official Contact Email
        </p>
        <p className="font-display text-xl sm:text-2xl font-bold text-[#2B3445] mt-1 break-all select-all">
          {CONTACT_EMAIL}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold">When to Reach Out</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong className="text-[#2B3445]">General questions:</strong> Questions about using Play Aura or browsing games.
          </li>
          <li>
            <strong className="text-[#2B3445]">Game-related concerns:</strong> Reporting a game that is broken or not loading properly.
          </li>
          <li>
            <strong className="text-[#2B3445]">Copyright concerns:</strong> Intellectual property notices or content removal requests.
          </li>
          <li>
            <strong className="text-[#2B3445]">Privacy questions:</strong> Inquiries regarding our Privacy Policy or suggestion deletion requests.
          </li>
          <li>
            <strong className="text-[#2B3445]">Website feedback:</strong> Accessibility, usability, or general site improvement notes.
          </li>
        </ul>
      </section>
    </div>
  );
}

function DisclaimerContent() {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          Disclaimer
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          Last updated: November 21, 2026
        </p>
      </header>

      <section className="space-y-3 text-sm sm:text-base text-[#5A657A]">
        <p>
          Play Aura makes curated online browser games available for visitors to enjoy directly in their web browser. Some games featured on the platform may be created and owned by third-party developers or publishers.
        </p>
        <p>
          All copyrights, trademarks, game titles, artwork, audio, and other intellectual property associated with third-party games remain the property of their respective owners. Play Aura does not claim ownership over third-party games and does not necessarily author or control every piece of third-party game content.
        </p>
        <p>
          Because web browsers, third-party assets, and hosting environments evolve over time, game availability, compatibility, and performance may change without notice. The website itself may also undergo periodic maintenance, updates, or occasional technical interruptions.
        </p>
        <p>
          If you have a copyright concern, notice broken or inappropriate content, or would like to report an issue with any listing on Play Aura, please contact us at{' '}
          <span className="font-bold text-[#1D6B52]">{CONTACT_EMAIL}</span>.
        </p>
      </section>
    </div>
  );
}

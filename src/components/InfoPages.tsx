import type { MouseEvent } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import type { ActiveView } from '../types/game';

interface InfoPageProps {
  view: Exclude<ActiveView, 'home' | 'admin'>;
  onNavigate: (view: ActiveView) => void;
}

const CONTACT_EMAIL = '123playaura@gmail.com';

const RELATED_PAGES: Array<{ view: Exclude<ActiveView, 'home' | 'admin'>; href: string; label: string }> = [
  { view: 'about', href: '/about', label: 'About Us' },
  { view: 'privacy-policy', href: '/privacy-policy', label: 'Privacy Policy' },
  { view: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { view: 'disclaimer', href: '/disclaimer', label: 'Disclaimer' },
  { view: 'contact', href: '/contact', label: 'Contact Us' },
];

export function InfoPage({ view, onNavigate }: InfoPageProps) {
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
        {view === 'privacy-policy' && <PrivacyPolicyContent />}
        {view === 'terms' && <TermsContent />}
        {view === 'about' && <AboutContent />}
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

function PrivacyPolicyContent() {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          Privacy Policy
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          Last updated: November 19, 2026
        </p>
      </header>

      <p className="text-base text-[#5A657A]">
        Play Aura respects your privacy and keeps data collection minimal. This Privacy Policy explains what information is processed when you browse games or submit a game suggestion on{' '}
        <span className="font-semibold text-[#2B3445]">https://play-aura-website.pages.dev/</span>.
      </p>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">1. Information We Collect</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Visitors can browse and play games on Play Aura without creating an account or providing a name, email address, phone number, or physical address. We intentionally do not ask for personal contact details inside our Game Suggestion form.
        </p>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you voluntarily submit a game suggestion, we store:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>The suggestion text you wrote.</li>
          <li>A one-way cryptographic SHA-256 hash of a random anonymous identifier stored in your browser.</li>
          <li>Submission timestamp and moderation status.</li>
        </ul>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you contact us directly by email, we receive the email address and message contents you choose to send.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          2. Technical Information from Hosting &amp; Security Services
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura is hosted on Cloudflare Pages and connects to Supabase for game files and suggestion storage. Like most web platforms, these hosting and infrastructure providers automatically process standard technical request data (such as IP address, browser user-agent, requested URL, and timestamps) to deliver pages reliably, prevent abuse, and keep the service secure.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          3. Cookies, Local Storage &amp; Analytics
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura currently does <strong>not</strong> use third-party website analytics trackers (such as Google Analytics).
        </p>
        <p className="text-sm sm:text-base text-[#5A657A]">
          We use browser <code className="font-mono text-xs bg-[#FAF5E8] px-1.5 py-0.5 rounded">localStorage</code> strictly for essential functionality:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong>Anonymous Suggestion Token &amp; Cooldown:</strong> Keeps a random browser token and recent submission timestamp locally so repeated spam submissions can be rate-limited.
          </li>
          <li>
            <strong>Administrator Sign-In Session:</strong> Used only by authorized site administrators signing into the private admin dashboard.
          </li>
        </ul>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura includes optional integration support for Google AdSense, which is currently disabled unless configured by the site owner. If advertising is enabled in the future, advertising partners may use cookies or similar technologies in accordance with their policies and any required consent controls.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          4. Anonymous Visitor Identifiers &amp; Moderation
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          To protect the suggestion box from spam and abusive submissions without requiring accounts, the browser generates a random anonymous token and sends only its SHA-256 hash when you submit an idea. Authorized site administrators may review suggestions and block an anonymous visitor hash from submitting further suggestions. Because this identifier is stored in browser local storage, clearing browser data or switching browsers will generate a new token.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          5. Third-Party Services &amp; External Links
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong>Cloudflare Pages:</strong> Static website hosting and content delivery.
          </li>
          <li>
            <strong>Supabase:</strong> Database and file storage for hosted HTML5 games, thumbnails, administrator authentication, and game suggestion moderation.
          </li>
          <li>
            <strong>Google Fonts:</strong> Serves display and body web fonts used across the site.
          </li>
          <li>
            <strong>YouTube External Link:</strong> Clicking the Play Aura YouTube icon opens our YouTube channel in a new tab, which is governed by Google/YouTube&apos;s own privacy policy.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          6. Data Retention &amp; Deletion
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Game suggestions are kept only as long as useful for planning future games and enforcing moderation. Administrators can delete individual suggestions or remove visitor blocks directly from the Admin Portal. Visitors can remove their local anonymous browser token at any time by clearing site data in browser settings, or contact us to request deletion of a submitted suggestion.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">7. Privacy Contact</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you have questions about privacy or wish to request deletion of content, please email us at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-bold text-[#1D6B52] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
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
          Terms &amp; Conditions
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          Last updated: November 19, 2026
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">1. Acceptance of Terms</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          By accessing or using Play Aura, you agree to comply with these Terms &amp; Conditions and all applicable laws. If you do not agree with these terms, please discontinue use of the website.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">2. Appropriate Website Use &amp; Gameplay</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura is provided for personal, non-commercial entertainment in your web browser. Games are played directly on the site within browser sandboxes. You agree to use the website respectfully and not interfere with normal gameplay or other visitors&apos; access.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          3. Third-Party Games &amp; Intellectual Property
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura branding, layout, and original site assets belong to Play Aura. Games hosted or featured on the platform may be owned and created by their respective developers and rights holders, and all trademarks, artwork, audio, and code remain the property of their respective owners.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          4. Prohibited Conduct
        </h2>
        <ul className="list-disc pl-6 space-y-1.5 text-sm sm:text-base text-[#5A657A]">
          <li>Attempting to hack, probe, bypass security controls, or gain unauthorized access to the Admin Portal or database.</li>
          <li>Sending automated traffic, denial-of-service requests, malicious files, or spam.</li>
          <li>Reverse-engineering, disrupting, or damaging website infrastructure or hosted game files.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          5. Game Suggestion Rules &amp; Moderation Rights
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          When using the Game Suggestion feature, you agree not to submit abusive language, spam, advertising links, or any personal information (such as names, email addresses, phone numbers, or home addresses). Play Aura reserves the right to review, archive, or delete any suggestion and to block anonymous visitor identifiers associated with spam or policy violations from submitting future suggestions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          6. Updates, Maintenance &amp; Availability
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          We may add, modify, pause, or remove games and website features at any time without prior notice. The website is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis and may occasionally experience downtime or maintenance.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">
          7. Copyright Concerns &amp; Contact
        </h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          If you are a copyright owner or authorized representative and believe content on Play Aura infringes your rights, please contact us at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-bold text-[#1D6B52] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{' '}
          with details so we can review and address the request promptly.
        </p>
      </section>
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-6 text-[#2B3445] leading-relaxed">
      <header className="space-y-2 border-b border-[#EAE3CE] pb-5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B3445]">
          About Play Aura
        </h1>
        <p className="text-sm font-semibold text-[#5A657A]">
          A gentle, browser-first HTML5 gaming playground
        </p>
      </header>

      <section className="space-y-3 text-sm sm:text-base text-[#5A657A]">
        <p>
          <strong className="text-[#2B3445]">Play Aura</strong> is an online browser gaming platform designed to make discovering and playing HTML5 web games simple, calm, and instant. There are no downloads, installations, or accounts required to start playing.
        </p>
        <p>
          Visitors can browse the published game collection, search for games by title, and launch any game card right inside the browser.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">Community Game Suggestions</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Play Aura grows alongside the people who play here. Using the Suggestion button on the homepage, visitors can share ideas for genres, themes, or gameplay styles they would enjoy seeing next. Those suggestions help guide future game selection and creative development on the platform.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">Our Goal</h2>
        <p className="text-sm sm:text-base text-[#5A657A]">
          Our focus is offering a clean, cheerful, and accessible browser gaming experience that works smoothly across desktop, tablet, and mobile screens.
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
          We welcome questions, feedback, and copyright or privacy inquiries.
        </p>
      </header>

      <div className="rounded-[24px] bg-[#D8F3E5]/55 border-2 border-[#BFEAD6] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#1D6B52]">
            Official Contact Email
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-[#2B3445] mt-1 break-all">
            Email: {CONTACT_EMAIL}
          </p>
        </div>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="bubble-button inline-flex items-center justify-center gap-2 rounded-full bg-[#BFEAD6] hover:bg-[#A9E0C6] text-[#1D6B52] px-6 py-3 text-sm font-bold whitespace-nowrap shrink-0"
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          <span>Send Email</span>
        </a>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold">When to Reach Out</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base text-[#5A657A]">
          <li>
            <strong className="text-[#2B3445]">General questions:</strong> Questions about using Play Aura or finding games.
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
          Last updated: November 19, 2026
        </p>
      </header>

      <section className="space-y-3 text-sm sm:text-base text-[#5A657A]">
        <p>
          Play Aura makes curated HTML5 browser games available for visitors to enjoy online. Some games featured on the platform may be created and owned by third-party developers or publishers.
        </p>
        <p>
          All copyrights, trademarks, game titles, artwork, audio, and other intellectual property associated with third-party games remain the property of their respective owners. Play Aura does not claim ownership over third-party games and does not necessarily author or control every piece of third-party game content.
        </p>
        <p>
          Because web browsers, third-party assets, and hosting environments evolve over time, game availability, compatibility, and performance may change without notice. The website itself may also undergo periodic maintenance, updates, or occasional technical interruptions.
        </p>
        <p>
          If you have a copyright concern, notice broken or inappropriate content, or would like to report an issue with any listing on Play Aura, please reach out to us at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-bold text-[#1D6B52] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}

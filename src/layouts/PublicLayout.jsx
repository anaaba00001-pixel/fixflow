import { navigate } from "../routes/AppRouter";

export default function PublicLayout({ children }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <button className="public-brand" onClick={() => navigate("/")}>
          <span className="brand-mark">F</span>
          <span><strong>FixFlow</strong><small>إدارة الصيانة بوضوح</small></span>
        </button>
        <span className="secure-note">اتصال آمن · بياناتك محمية</span>
      </header>
      <main className="public-content">{children}</main>
      <footer>© 2026 FixFlow · منصة إدارة الصيانة</footer>
    </div>
  );
}

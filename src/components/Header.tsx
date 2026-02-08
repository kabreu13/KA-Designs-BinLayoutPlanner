import { useLayout } from '../context/LayoutContext';
import { CircleHelp } from 'lucide-react';
import { OPEN_HOW_TO_EVENT } from '../lib/uiEvents';
import styles from './Header.module.css';

export function Header() {
  const { layoutTitle, setLayoutTitle } = useLayout();
  const openHowTo = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(OPEN_HOW_TO_EVENT));
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img
            src="/ka-logo.png"
            alt="KA Designs logo"
            className={styles.logo}
          />
          <span className={styles.brandName}>
            Bin Layout Planner
          </span>
        </div>

        <div className={styles.titleWrap}>
          <input
            data-testid="layout-title-input"
            type="text"
            value={layoutTitle}
            onChange={(event) => setLayoutTitle(event.target.value)}
            placeholder="Layout Title"
            maxLength={80}
            className={styles.titleInput}
            aria-label="Layout title"
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            data-testid="header-how-to-button"
            onClick={openHowTo}
            className={styles.howToButton}
          >
            <CircleHelp className={styles.howToIcon} />
            How To
          </button>
        </div>
      </div>
    </header>
  );
}

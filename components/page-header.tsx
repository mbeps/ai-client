/**
 * Props for the PageHeader component.
 *
 * @author Maruf Bepary
 */
interface PageHeaderProps {
  /** Icon element displayed to the left of the title block. */
  icon: React.ReactNode;
  /** Primary heading text. */
  title: string;
  /** Supporting subheading shown below the title. */
  description: string;
  /** Optional action element (e.g. a button) aligned to the far right. */
  action?: React.ReactNode;
}

/**
 * Standardised top-of-page header used across entity listing pages.
 * Renders an icon, title, and description in a row with an optional right-aligned action slot.
 *
 * @param props.icon - Leading icon for the page type.
 * @param props.title - Page heading.
 * @param props.description - Brief description shown below the heading.
 * @param props.action - Optional button or control placed in the header's action area.
 * @author Maruf Bepary
 */
export function PageHeader({
  icon,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      {action && <div className="w-full md:w-auto">{action}</div>}
    </div>
  );
}

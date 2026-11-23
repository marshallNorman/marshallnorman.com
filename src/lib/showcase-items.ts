export type ShowcaseItem = {
  type: string;
  title: string;
  description: string;
  href: string;
  newTab?: boolean;
  wip?: boolean;
};

// The work listed on /showcase (and, with additions, on client showcase pages)
export const showcaseItems: ShowcaseItem[] = [
  {
    type: 'Prototype',
    title: 'Agentic Studio',
    description: 'A full-featured prototype of a visual builder for composing AI agent workflows on a canvas. Simulate creating a new agent, and explore agent management features like the dashboard and Proving Ground.',
    href: '/showcase/prototypes/#/AgenticStudioE2eDemo',
  },
  {
    type: 'Prototype',
    title: 'Playbook',
    description: 'When AI detects a Playbook topic during a live call, the item checks itself off with an animation and a summary of the discussion.',
    href: '/showcase/prototypes/#/Playbook',
  },
  {
    type: 'Prototype',
    title: 'Dialpad Notification System',
    description: 'One notification system across Meetings and the Dialpad app. Live Coach, Chat and Playbook cards stack by type, and clicking one opens its tab in the right panel.',
    href: '/showcase/notifications-demo',
  },
  {
    type: 'Case study',
    title: "Designing Dialpad's Agentic AI Platform",
    description: 'Defined a unified agent model that moved beyond reactive feature shipping — aligning product, engineering, and leadership around a coherent AI vision.',
    href: '/case-studies/dialpad-ai-platform',
    newTab: true,
  },
  {
    type: 'Case study',
    title: 'Foundational design at Dialpad',
    description: "How I rebuilt Dialtone, Dialpad's design system, around a lean foundation, and how it held up through the company's shift to AI.",
    href: '/foundational-design-at-dialpad',
    newTab: true,
    wip: true,
  },
];

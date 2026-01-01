const ARCHIDOC_API_URL = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL || "https://archidoc.app";

export type ArchidocProject = {
  id: string;
  projectName: string;
  clientName: string;
  address: string;
  status: string;
  clients?: Array<{ id: string; name: string; email: string }>;
  items?: Array<{ id: string; title: string }>;
};

export type MappedProject = {
  id: string;
  name: string;
  location: string;
  status: string;
  clientName: string;
};

export function getArchidocApiUrl(): string {
  return ARCHIDOC_API_URL;
}

export async function fetchArchidocProjects(): Promise<MappedProject[]> {
  const response = await fetch(`${ARCHIDOC_API_URL}/api/projects`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects from ARCHIDOC");
  }
  const projects: ArchidocProject[] = await response.json();
  return projects.map((p) => ({
    id: p.id,
    name: p.projectName,
    location: p.address,
    status: p.status,
    clientName: p.clientName,
  }));
}

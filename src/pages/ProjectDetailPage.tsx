import { ArrowLeft, Terminal } from 'lucide-react';
import { MarkdownChatView } from '../components/MarkdownChatView';
import { getProjectsHashRoute } from '../lib/projectRoutes';
import { getProjectBySlug } from '../lib/projectsContent';

interface ProjectDetailPageProps {
  slug: string;
}

export function ProjectDetailPage({ slug }: ProjectDetailPageProps) {
  const project = getProjectBySlug(slug);

  if (!project) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl rounded border border-green-matrix/30 bg-black-light/40 p-6">
          <p className="font-mono text-sm text-green-darker">{'> /projects/:slug'}</p>
          <h1 className="mt-2 text-3xl text-green-matrix">Project Not Found</h1>
          <p className="mt-3 text-green-dark">No markdown file matches this project slug.</p>
          <a
            href={getProjectsHashRoute()}
            className="mt-5 inline-flex items-center gap-2 border border-green-matrix/40 px-3 py-1.5 font-mono text-sm text-green-dark transition-colors hover:bg-green-matrix hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <a
            href={getProjectsHashRoute()}
            className="inline-flex items-center gap-2 border border-green-matrix/40 px-3 py-1.5 font-mono text-sm text-green-dark transition-colors hover:bg-green-matrix hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </a>
          <p className="font-mono text-xs text-green-darker">{`/projects/${project.slug}.md`}</p>
        </div>

        <div className="rounded border border-green-matrix/30 bg-black-light/40">
          <div className="flex items-center justify-between border-b border-green-matrix/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-matrix" />
              <p className="font-mono text-sm text-green-matrix">project-transcript.window</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-darker/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-dark/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-matrix/70" />
            </div>
          </div>

          <div className="border-b border-green-matrix/15 px-4 py-3">
            <h1 className="text-2xl text-green-matrix">{project.title}</h1>
            <p className="mt-1 text-sm text-green-dark">{project.summary}</p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-4 font-mono text-sm">
            <p className="mb-4 text-green-darker">{'> static render: markdown transcript mode'}</p>
            <MarkdownChatView markdown={project.content} />
          </div>
        </div>
      </div>
    </div>
  );
}

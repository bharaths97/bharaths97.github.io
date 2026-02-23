import { ArrowLeft, FileText, Terminal } from 'lucide-react';
import { getPortfolioHashRoute, getProjectDetailHashRoute } from '../lib/projectRoutes';
import { projectDocuments } from '../lib/projectsContent';

export function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-50 opacity-10">
        <div
          className="h-full w-full bg-gradient-to-b from-transparent via-[#00ff41] to-transparent animate-[scan_8s_linear_infinite]"
          style={{
            backgroundSize: '100% 4px',
            animation: 'scan 8s linear infinite'
          }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-green-matrix/30 bg-black-deep/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-green-matrix">
            <Terminal className="h-5 w-5" />
            <span className="font-mono">projects.archive</span>
          </div>
          <a
            href={getPortfolioHashRoute()}
            className="inline-flex items-center gap-2 border border-green-matrix/40 px-3 py-1.5 font-mono text-sm text-green-dark transition-colors hover:bg-green-matrix hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back Home</span>
          </a>
        </div>
      </header>

      <main className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8">
            <p className="font-mono text-sm text-green-darker">{'> /projects'}</p>
            <h1 className="mt-2 text-4xl md:text-5xl">Project Knowledge Base</h1>
            <p className="mt-3 max-w-2xl text-green-dark">
              Detailed, markdown-backed write-ups. Click a card to open the project transcript view.
            </p>
          </div>

          {projectDocuments.length === 0 ? (
            <div className="rounded border border-green-matrix/30 bg-black-light/40 p-6">
              <p className="font-mono text-green-dark">No markdown files found in `src/content/projects`.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {projectDocuments.map((project, index) => (
                <a
                  key={project.slug}
                  href={getProjectDetailHashRoute(project.slug)}
                  className="group relative block border border-green-matrix/30 bg-black-light p-5 transition-colors hover:border-green-matrix"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-green-darker">{`[ID:${String(index + 1).padStart(2, '0')}]`}</p>
                    <FileText className="h-4 w-4 text-green-matrix/80 group-hover:text-green-matrix" />
                  </div>

                  <h2 className="mb-2 text-xl text-green-matrix">{project.title}</h2>
                  <p className="mb-4 text-sm text-green-dark">{project.summary}</p>

                  <div className="flex flex-wrap gap-2">
                    {project.tags.length > 0 ? (
                      project.tags.map((tag) => (
                        <span
                          key={`${project.slug}-${tag}`}
                          className="border border-green-matrix/30 px-2 py-0.5 font-mono text-xs text-green-darker"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="border border-green-matrix/20 px-2 py-0.5 font-mono text-xs text-green-darker/80">untagged</span>
                    )}
                  </div>

                  <p className="mt-4 font-mono text-xs text-green-dark group-hover:text-green-matrix">open transcript {'>>'}</p>
                  <div className="absolute right-0 top-0 h-10 w-10 border-r-2 border-t-2 border-green-matrix/30" />
                </a>
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}

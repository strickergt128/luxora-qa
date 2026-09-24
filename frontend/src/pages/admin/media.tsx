import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type MediaFile = { filename: string; size: number; mtime: string; url: string };

function AdminMediaPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "media:read");
  const canWrite = hasPerm(user as any, "media:write");

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    try {
      const { data } = await api.get("/admin/media");
      setFiles(data || []);
    } catch {
      toast.error("Failed to load media vault");
    }
  };

  useEffect(() => {
    if (!canRead) return;
    fetchFiles();
  }, [canRead]);

  const upload = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to upload media");
      return;
    }
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/admin/media", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Media asset uploaded successfully");
      setFile(null);
      fetchFiles();
    } catch {
      toast.error("Upload failed");
    }
  };

  const del = async (filename: string) => {
    if (!canWrite) {
      toast.error("You don't have permission to delete media");
      return;
    }
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      const encoded = encodeURIComponent(filename);
      await api.delete(`/admin/media/${encoded}`);
      toast.success("Asset deleted successfully");
      fetchFiles();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Delete failed";
      toast.error(msg);
    }
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Media Vault</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Upload and organize promotional banners, product catalog images, and site assets.
          </p>
        </div>

        {!canRead ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-8 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            You don&apos;t have access to the Media Vault.
          </div>
        ) : (
          <>
            <PermissionGate perm="media:write">
              <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft mb-8 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-4 flex-wrap">
                  <input
                    id="media-upload"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="media-upload"
                    className="btn px-4 py-2 cursor-pointer flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M4 3a2 2 0 00-2 2v2h2V5h12v10H4v-2H2v2a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4z" />
                      <path d="M9 7v3H6l4 4 4-4h-3V7H9z" />
                    </svg>
                    Choose Asset File
                  </label>
                  {file && (
                    <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                      {file.name}
                    </span>
                  )}
                  {file && (
                    <button
                      onClick={upload}
                      className="btn-primary px-5 py-2"
                    >
                      Upload File
                    </button>
                  )}
                </div>
              </div>
            </PermissionGate>

            {files.length === 0 ? (
              <div className="bg-card/60 backdrop-blur-md border border-border/40 p-10 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider italic">
                No media vault files have been uploaded yet.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {files.map((f) => (
                  <div
                    key={f.filename}
                    className="group bg-card/60 backdrop-blur-md border border-border/40 rounded-xl overflow-hidden shadow-soft hover:border-primary/40 transition-all duration-200"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-secondary/10 border-b border-border/20">
                      <img
                        src={f.url}
                        alt={f.filename}
                        className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) =>
                          ((e.currentTarget as HTMLImageElement).src =
                            "/fallback.png")
                        }
                      />
                    </div>
                    <div className="p-4 text-xs">
                      <div className="truncate text-foreground font-semibold" title={f.filename}>
                        {f.filename}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                        {(f.size / 1024).toFixed(1)} KB
                      </div>
                      <PermissionGate perm="media:write">
                        <div className="flex justify-end mt-3 pt-3 border-t border-border/10">
                          <button
                            onClick={() => del(f.filename)}
                            className="btn border-rose-500/30 text-rose-500 hover:bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                          >
                            Delete
                          </button>
                        </div>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminMediaPage), { ssr: false });

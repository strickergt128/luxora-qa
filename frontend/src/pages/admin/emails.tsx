import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/layout/ProtectedRoute";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/layout/PermissionGate";
import api from "../../utils/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { hasPerm } from "../../utils/permissions";

type TemplateMeta = { key: string; hasOverride: boolean };
type TemplateData = {
  key: string;
  default: { subject: string; html: string };
  override: { subject: string; html: string } | null;
  samples: any;
};

function IframePreview({ html }: { html: string }) {
  const srcDoc = useMemo(
    () => html || "<html><body style='font-family:sans-serif;color:#666;padding:20px;'><p>No preview compiled.</p></body></html>",
    [html]
  );
  return (
    <iframe
      className="w-full h-[600px] bg-white rounded-xl border border-border/40 shadow-soft"
      srcDoc={srcDoc}
      sandbox=""
    />
  );
}

function AdminEmailsPage() {
  const { user } = useAuth();
  const canRead = hasPerm(user as any, "emailTemplates:read");
  const canWrite = hasPerm(user as any, "emailTemplates:write");

  const [list, setList] = useState<TemplateMeta[]>([]);
  const [active, setActive] = useState<string>("welcome");
  const [data, setData] = useState<TemplateData | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    try {
      const { data } = await api.get("/admin/emails");
      setList(data || []);
    } catch {
      toast.error("Failed to load email templates list");
    }
  };

  const fetchOne = async (key: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/emails/${key}`);
      setData(data);
      setSubject(data.override?.subject || data.default.subject);
      setHtml(data.override?.html || data.default.html);
      const preview = await api.post("/admin/emails/render", {
        key,
        subject: data.override?.subject,
        html: data.override?.html,
      });
      setPreviewHtml(preview.data.html);
    } catch {
      toast.error("Failed to load email template");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canRead) return;
    fetchList();
  }, [canRead]);

  useEffect(() => {
    if (!canRead || !active) return;
    fetchOne(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, canRead]);

  const renderPreview = async () => {
    try {
      const { data } = await api.post("/admin/emails/render", {
        key: active,
        subject,
        html,
      });
      setPreviewHtml(data.html);
    } catch {
      toast.error("Preview render failed");
    }
  };

  const save = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to modify templates");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/emails/${active}`, { subject, html });
      toast.success("Template override saved successfully");
      fetchList();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute roles={["admin", "subadmin"]}>
      <AdminLayout>
        <div className="border-b border-border/40 pb-5 mb-8">
          <h1 className="display-font text-3xl font-semibold tracking-wide text-foreground">Email Notification Templates</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Override transactional email subjects, contents, brand assets, and markup templates.
          </p>
        </div>

        {!canRead ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/40 p-8 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            You don&apos;t have access to Email Notification Templates.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[280px,1fr,1fr] gap-8 items-start">
            {/* Sidebar list */}
            <aside className="bg-card/65 backdrop-blur-md border border-border/40 p-4 rounded-xl shadow-soft">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2 mb-3">
                Notification Events
              </h3>
              <div className="space-y-1.5">
                {list.map((t) => {
                  const activeCls =
                    t.key === active
                      ? "bg-primary/10 border-primary text-primary font-bold"
                      : "bg-card/45 border-border/25 text-muted-foreground hover:text-foreground hover:bg-card/75";
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActive(t.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-all duration-200 uppercase tracking-wider ${activeCls}`}
                    >
                      <span>{t.key}</span>
                      {t.hasOverride && (
                        <span className="text-[8px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-sm">
                          Override
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Editor */}
            <section className="space-y-6">
              {loading || !data ? (
                <div className="bg-card/60 backdrop-blur-md border border-border/40 p-10 rounded-xl shadow-soft text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Loading template metadata...
                </div>
              ) : (
                <>
                  <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft text-xs">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Subject Line Header
                    </label>
                    <input
                      value={subject}
                      aria-label="Email subject line input"
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={!canWrite}
                      className="w-full bg-card/60 border border-border/88 rounded-md px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all duration-200 disabled:opacity-50"
                    />
                  </div>
                  <div className="bg-card/65 backdrop-blur-md border border-border/40 p-5 rounded-xl shadow-soft text-xs">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      HTML Source Markup
                    </label>
                    <textarea
                      value={html}
                      aria-label="Email HTML source markup editor"
                      onChange={(e) => setHtml(e.target.value)}
                      disabled={!canWrite}
                      className="w-full h-[400px] bg-card/45 border border-border/80 rounded-md px-3.5 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-primary transition-all duration-200 disabled:opacity-50"
                    />
                    <div className="flex gap-3 mt-4 pt-3 border-t border-border/20 justify-end">
                      <button
                        onClick={renderPreview}
                        className="btn px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                      >
                        Compile Preview
                      </button>

                      <PermissionGate perm="emailTemplates:write">
                        <button
                          onClick={save}
                          disabled={saving}
                          className="btn-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                        >
                          {saving ? "Saving Override..." : "Save Override"}
                        </button>
                      </PermissionGate>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/20">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Template Tokens Reference</div>
                      <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-mono">
                        {"{{frontend.resetPasswordUrl}}"}, {"{{user.name}}"}, {"{{user.email}}"}, {"{{order._id}}"},{" "}
                        {"{{order.totalAmount}}"}, {"{{order.itemsHtml}}"}, {"{{frontend.orderUrl}}"}, {"{{token}}"},{" "}
                        {"{{product.title}}"}, {"{{oldPrice}}"}, {"{{newPrice}}"}, {"{{frontend.productUrl}}"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Preview */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">
                Live Iframe Render
              </h3>
              <IframePreview html={previewHtml} />
            </section>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default dynamic(() => Promise.resolve(AdminEmailsPage), { ssr: false });

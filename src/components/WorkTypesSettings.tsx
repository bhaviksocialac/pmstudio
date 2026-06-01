import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { useWorkTypes } from "@/hooks/useWorkTypes";
import { toast } from "sonner";

export function WorkTypesSettings() {
  const wt = useWorkTypes();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (wt.isLoading) {
    return (
      <section className="rounded-[16px] bg-card border border-border p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  const onAdd = () => {
    const v = newName.trim();
    if (!v) return;
    wt.addWorkType(v);
    setNewName("");
  };

  const onStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const onSaveEdit = async () => {
    if (!editingId) return;
    const v = editValue.trim();
    if (!v) return;
    try {
      await wt.rename(editingId, v);
      setEditingId(null);
      toast.success("Renamed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete work type "${name}"? Tasks using it keep the label.`)) return;
    try {
      await wt.remove(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <section
      className="rounded-[16px] bg-card border border-border p-5 md:p-6"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Tasks
        </div>
        <h2 className="font-display text-2xl">Work Types</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Custom work types appear in the dropdown on every task across every project.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="Add custom work type — e.g. Bosch"
          className="flex-1 h-10 px-3 rounded-[8px] bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={onAdd}
          disabled={!newName.trim()}
          className="h-10 px-4 rounded-[8px] bg-[#c17f5a] text-white text-sm font-medium hover:bg-[#a86b4a] disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">
            Your Custom Types ({wt.customs.length})
          </h3>
          {wt.customs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No custom work types yet.</p>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-[8px] overflow-hidden">
              {wt.customs.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-muted/30"
                >
                  {editingId === c.id ? (
                    <>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
                        autoFocus
                        className="flex-1 h-8 px-2 rounded-[6px] border border-border text-sm"
                      />
                      <button
                        onClick={onSaveEdit}
                        className="h-8 w-8 rounded-[6px] hover:bg-[#7a9e8a22] inline-flex items-center justify-center text-[#3f5a4d]"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-8 w-8 rounded-[6px] hover:bg-muted inline-flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{c.name}</span>
                      <button
                        onClick={() => onStartEdit(c.id, c.name)}
                        className="h-8 w-8 rounded-[6px] hover:bg-muted inline-flex items-center justify-center text-muted-foreground"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(c.id, c.name)}
                        className="h-8 w-8 rounded-[6px] hover:bg-[#c4685a22] inline-flex items-center justify-center text-[#c4685a]"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium mb-2">
            Default Types — hide what you don't use
          </h3>
          <div className="flex flex-wrap gap-2">
            {wt.defaults.map((d) => {
              const hidden = wt.hiddenDefaults.has(d.toLowerCase());
              return (
                <button
                  key={d}
                  onClick={() => wt.setDefaultHidden(d, !hidden)}
                  className={`h-8 px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-all ${
                    hidden
                      ? "bg-muted/40 border-border text-muted-foreground line-through"
                      : "bg-white border-[#c17f5a55] text-foreground hover:bg-[#c17f5a14]"
                  }`}
                  title={hidden ? "Hidden — click to show" : "Visible — click to hide"}
                >
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

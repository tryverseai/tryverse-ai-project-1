import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  type Product,
  type TryOnCategory,
} from "@/lib/backendApi";
import { safeImageSrcForDom, safeHttpHrefForDom } from "@/lib/safeUrl";

const CATEGORIES: { id: TryOnCategory; label: string }[] = [
  { id: "clothing", label: "Clothing" },
  { id: "bags", label: "Bags" },
  { id: "glasses", label: "Eyewear" },
];

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TryOnCategory | "">("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    image_url: "",
    category: "clothing" as TryOnCategory,
    product_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getProducts(pagination.page, pagination.limit, categoryFilter || undefined);
      setProducts(res.products ?? []);
      setPagination((p) => ({
        ...p,
        page: res.pagination?.page ?? p.page,
        limit: res.pagination?.limit ?? p.limit,
        total: res.pagination?.total ?? 0,
        pages: res.pagination?.pages ?? 1,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load products";
      setFetchError(msg);
      setProducts([]);
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [pagination.page, categoryFilter]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setImagePreviewUrl(null);
    setForm({
      name: "",
      image_url: "",
      category: "clothing",
      product_url: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setImagePreviewUrl(displayImage(p) || null);
    setForm({
      name: p.name,
      image_url: p.image_url || "",
      category: p.category,
      product_url: p.product_url || "",
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImagePreviewUrl(URL.createObjectURL(file));
    try {
      const { filePath } = await uploadImage(file, "product");
      setForm((f) => ({ ...f, image_url: filePath }));
      toast.success("Image uploaded");
    } catch (err) {
      setImagePreviewUrl(null);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.image_url && !editingProduct?.image_url) {
      toast.error("Product image is required");
      return;
    }
    setSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: form.name.trim(),
          image_url: form.image_url || undefined,
          category: form.category,
          product_url: form.product_url || undefined,
        });
        toast.success("Product updated");
      } else {
        await createProduct({
          name: form.name.trim(),
          image_url: form.image_url || undefined,
          category: form.category,
          product_url: form.product_url || undefined,
        });
        toast.success("Product created");
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const displayImage = (p: Product) => p.image_display_url || p.image_url;
  const productImageSrc = (p: Product) => safeImageSrcForDom(displayImage(p));
  const productPageHref = (p: Product) => safeHttpHrefForDom(p.product_url || undefined);

  const dialogPreviewSrc = safeImageSrcForDom(
    imagePreviewUrl ||
      (form.image_url?.startsWith("http") || form.image_url?.startsWith("/") ? form.image_url : "")
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your product catalog for virtual try-on
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={categoryFilter || "all"}
          onValueChange={(v) => setCategoryFilter(v === "all" ? "" : (v as TryOnCategory))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading products…</p>
        </div>
      ) : fetchError ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Package className="h-8 w-8 text-destructive/60 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Could not load products</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4 font-mono">
            {fetchError}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
            {fetchError.includes("exist") || fetchError.includes("relation")
              ? "Make sure the products table exists. Run the migration in Supabase Dashboard → SQL Editor."
              : "Check your connection and try again."}
          </p>
          <Button onClick={fetchProducts} variant="outline">
            Retry
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            No products yet
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Add products to your catalog so shoppers can try them on with the
            widget.
          </p>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                    Product
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                    Category
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                    Try-Ons
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">
                    Last updated
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {productImageSrc(p) ? (
                            <img
                              src={productImageSrc(p)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 m-3 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {p.name}
                          </p>
                          {productPageHref(p) && (
                            <a
                              href={productPageHref(p)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> View page
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground capitalize">
                      {p.category}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium">
                      {(p.tryons_count ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString()
                        : p.created_at
                        ? new Date(p.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(p)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {pagination.total} product{pagination.total !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Blue Denim Jacket"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Image</label>
              <div className="flex gap-3">
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-foreground/30 overflow-hidden">
                  {dialogPreviewSrc ? (
                    <img
                      src={dialogPreviewSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
                <div className="flex-1">
                  <Input
                    value={form.image_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, image_url: e.target.value }))
                    }
                    placeholder="Or paste image URL"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as TryOnCategory }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Product URL (optional)
              </label>
              <Input
                value={form.product_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, product_url: e.target.value }))
                }
                placeholder="https://yoursite.com/product/..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingProduct ? (
                "Save"
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

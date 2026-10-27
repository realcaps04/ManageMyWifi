import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function UsersPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createUser({
        full_name: name.trim(),
        email: email.trim() || null,
      }),
    onSuccess: () => {
      setName("");
      setEmail("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Register user</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading && (
            <p className="text-sm text-muted">Loading users…</p>
          )}
          {users.data?.data.length === 0 && (
            <p className="text-sm text-muted">No registered users yet.</p>
          )}
          <ul className="divide-y divide-border">
            {users.data?.data.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.full_name}</span>
                    <Badge variant={u.status === "active" ? "success" : "muted"}>
                      {u.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted">{u.email || "No email"}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove.mutate(u.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

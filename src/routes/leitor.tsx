import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/leitor")({
  component: LeitorDisabled,
});

function LeitorDisabled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-lg font-semibold mb-2">Recurso desativado</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Esta função foi temporariamente desativada.
      </p>
      <Button onClick={() => navigate({ to: "/" })}>
        Voltar para o Transpositor
      </Button>
    </div>
  );
}

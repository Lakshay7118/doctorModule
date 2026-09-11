"use client";

import * as React from "react";
import { Badge, Card, EmptyState, Mono, SectionHeader, Table } from "./ui";
import { useReceptionistData } from "./data-context";

export function Documents() {
  const { context, documents } = useReceptionistData();

  return (
    <div>
      <SectionHeader
        eyebrow={`${context.label} - Documents`}
        title="Document collection"
        description="Track permitted administrative documents and route missing or expired documents to the correct desk."
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="rp-h2 !mb-0">Document status</h2>
          <Badge tone="amber">{documents.filter((document) => document.status === "Expired").length} attention</Badge>
        </div>
        {documents.length === 0 ? (
          <EmptyState title="No documents on file" description="Uploaded consent, ID, referral and administrative documents will appear here." />
        ) : (
          <Table columns={["Document", "Category", "Patient", "UHID", "Uploaded", "Status"]}>
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="font-medium text-[var(--rp-ink)]">{document.title}</td>
                <td>{document.category}</td>
                <td>{document.patient}</td>
                <td><Mono>{document.uhid}</Mono></td>
                <td>{document.uploadedAt}</td>
                <td><Badge tone={document.status === "Expired" ? "coral" : "pine"}>{document.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

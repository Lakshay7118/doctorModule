import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  HospitalDocumentItem,
  PolicyTemplateItem,
  ContractItem,
  DMSAnalyticsSummary,
} from "@/hospital-admin/lib/types/documents";
import {
  mockHospitalDocuments,
  mockPolicyTemplates,
  mockContracts,
  mockDmsAnalyticsSummary,
} from "@/hospital-admin/lib/mock-data/documents";

export interface DocumentsState {
  documents: HospitalDocumentItem[];
  policyTemplates: PolicyTemplateItem[];
  contracts: ContractItem[];
  analytics: DMSAnalyticsSummary;
}

const initialState: DocumentsState = {
  documents: mockHospitalDocuments,
  policyTemplates: mockPolicyTemplates,
  contracts: mockContracts,
  analytics: mockDmsAnalyticsSummary,
};

export const documentsSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    hydrateDocumentsState: (state, action: PayloadAction<Partial<DocumentsState>>) => {
      if (action.payload.documents) state.documents = action.payload.documents;
      if (action.payload.policyTemplates) state.policyTemplates = action.payload.policyTemplates;
      if (action.payload.contracts) state.contracts = action.payload.contracts;
      if (action.payload.analytics) state.analytics = action.payload.analytics;
    },

    addDocument: (state, action: PayloadAction<HospitalDocumentItem>) => {
      state.documents.unshift(action.payload);
      state.analytics.totalDocumentsCount += 1;

      if (action.payload.category === "Policies") {
        state.analytics.activePoliciesCount += 1;
      } else if (action.payload.category === "Licenses") {
        state.analytics.professionalLicensesCount += 1;
      } else if (action.payload.category === "Certificates") {
        state.analytics.regulatoryCertificatesCount += 1;
      } else if (action.payload.category === "Contracts") {
        state.analytics.activeContractsCount += 1;
      }

      if (action.payload.isPublicCertificate) {
        state.analytics.publicRedactedCertsCount += 1;
      }
    },

    updateDocumentVersion: (
      state,
      action: PayloadAction<{
        id: string;
        newVersion: string;
        modifiedBy: string;
        changeSummary: string;
        newFileUrl?: string;
      }>
    ) => {
      const doc = state.documents.find((d) => d.id === action.payload.id);
      if (doc) {
        doc.version = action.payload.newVersion;
        doc.versionHistory.unshift({
          version: action.payload.newVersion,
          modifiedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
          modifiedBy: action.payload.modifiedBy,
          changeSummary: action.payload.changeSummary,
          fileUrl: action.payload.newFileUrl || doc.fileUrl,
          fileSize: doc.fileSize,
        });
        if (action.payload.newFileUrl) {
          doc.fileUrl = action.payload.newFileUrl;
        }
      }
    },

    addPolicyTemplate: (state, action: PayloadAction<PolicyTemplateItem>) => {
      state.policyTemplates.unshift(action.payload);

      // Also create a linked document record
      const linkedDoc: HospitalDocumentItem = {
        id: `DOC-POL-${Date.now()}`,
        documentCode: action.payload.code,
        title: action.payload.title,
        category: "Policies",
        subCategory: action.payload.type,
        departmentName: action.payload.department,
        version: action.payload.version,
        versionHistory: [
          {
            version: action.payload.version,
            modifiedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
            modifiedBy: action.payload.approvedBy,
            changeSummary: "Initial policy / template creation.",
            fileUrl: `/documents/templates/${action.payload.code.toLowerCase()}.pdf`,
            fileSize: "1.2 MB",
          },
        ],
        issuerAuthority: "Hospital Clinical Governance Committee",
        issueDate: action.payload.effectiveDate,
        isExpired: false,
        securityClassification: "Internal Staff Read-Only",
        isPublicCertificate: false,
        redactionStatus: "Not Required",
        fileUrl: `/documents/templates/${action.payload.code.toLowerCase()}.pdf`,
        fileSize: "1.2 MB",
        fileType: "PDF",
        uploadedBy: action.payload.approvedBy,
        uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        tags: [action.payload.type, action.payload.department],
      };

      state.documents.unshift(linkedDoc);
      state.analytics.activePoliciesCount += 1;
      state.analytics.totalDocumentsCount += 1;
    },

    registerContract: (state, action: PayloadAction<ContractItem>) => {
      state.contracts.unshift(action.payload);

      // Also create a linked document record
      const linkedDoc: HospitalDocumentItem = {
        id: `DOC-CTR-${Date.now()}`,
        documentCode: action.payload.contractCode,
        title: action.payload.title,
        category: "Contracts",
        subCategory: action.payload.contractType,
        departmentName: "Procurement & Assets",
        linkedEntityId: action.payload.vendorId,
        linkedEntityName: action.payload.vendorName,
        linkedEntityType: "Vendor",
        version: "v1.0",
        versionHistory: [
          {
            version: "v1.0",
            modifiedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
            modifiedBy: "Procurement Lead",
            changeSummary: "Initial contract registration.",
            fileUrl: `/documents/contracts/${action.payload.contractCode.toLowerCase()}.pdf`,
            fileSize: "3.5 MB",
          },
        ],
        issuerAuthority: `${action.payload.vendorName} & Hospital Procurement`,
        issueDate: action.payload.startDate,
        expiryDate: action.payload.endDate,
        isExpired: false,
        securityClassification: "Confidential: Admin & Compliance",
        isPublicCertificate: false,
        redactionStatus: "Not Required",
        fileUrl: `/documents/contracts/${action.payload.contractCode.toLowerCase()}.pdf`,
        fileSize: "3.5 MB",
        fileType: "PDF",
        uploadedBy: "Procurement Lead",
        uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        tags: [action.payload.contractType, action.payload.vendorName],
      };

      state.documents.unshift(linkedDoc);
      state.analytics.activeContractsCount += 1;
      state.analytics.totalDocumentsCount += 1;
    },

    deleteDocument: (state, action: PayloadAction<string>) => {
      state.documents = state.documents.filter((d) => d.id !== action.payload);
      state.analytics.totalDocumentsCount = Math.max(0, state.analytics.totalDocumentsCount - 1);
    },
  },
});

export const {
  hydrateDocumentsState,
  addDocument,
  updateDocumentVersion,
  addPolicyTemplate,
  registerContract,
  deleteDocument,
} = documentsSlice.actions;

export default documentsSlice.reducer;

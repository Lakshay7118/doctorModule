import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  ArticleItem,
  VideoAssetItem,
  PatientEducationItem,
  DoctorContentItem,
  DepartmentContentItem,
  ClinicalReviewRecord,
  ContentCategory,
  ContentStatus,
} from "@/hospital-admin/lib/types";
import {
  mockArticles,
  mockVideos,
  mockPatientEducation,
  mockDoctorContent,
  mockDepartmentContent,
} from "@/hospital-admin/lib/mock-data/content-resources";

export interface ContentResourcesState {
  articles: ArticleItem[];
  videos: VideoAssetItem[];
  patientEducation: PatientEducationItem[];
  doctorContent: DoctorContentItem[];
  departmentContent: DepartmentContentItem[];
}

const initialState: ContentResourcesState = {
  articles: mockArticles,
  videos: mockVideos,
  patientEducation: mockPatientEducation,
  doctorContent: mockDoctorContent,
  departmentContent: mockDepartmentContent,
};

export const contentResourcesSlice = createSlice({
  name: "contentResources",
  initialState,
  reducers: {
    hydrateContentResourcesState: (state, action: PayloadAction<Partial<ContentResourcesState>>) => {
      if (action.payload.articles) state.articles = action.payload.articles;
      if (action.payload.videos) state.videos = action.payload.videos;
      if (action.payload.patientEducation) state.patientEducation = action.payload.patientEducation;
      if (action.payload.doctorContent) state.doctorContent = action.payload.doctorContent;
      if (action.payload.departmentContent) state.departmentContent = action.payload.departmentContent;
    },

    // ------------------------------------------
    // ARTICLES
    // ------------------------------------------
    addArticle: (state, action: PayloadAction<ArticleItem>) => {
      state.articles.unshift(action.payload);
    },
    updateArticle: (state, action: PayloadAction<ArticleItem>) => {
      const idx = state.articles.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) {
        state.articles[idx] = {
          ...action.payload,
          version: state.articles[idx].version + 1,
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        };
      }
    },
    archiveArticle: (state, action: PayloadAction<string>) => {
      const art = state.articles.find((a) => a.id === action.payload);
      if (art) {
        art.status = "Archived";
        art.publishedToPublic = false;
      }
    },
    deleteArticle: (state, action: PayloadAction<string>) => {
      state.articles = state.articles.filter((a) => a.id !== action.payload);
    },

    // ------------------------------------------
    // VIDEOS
    // ------------------------------------------
    addVideo: (state, action: PayloadAction<VideoAssetItem>) => {
      state.videos.unshift(action.payload);
    },
    updateVideo: (state, action: PayloadAction<VideoAssetItem>) => {
      const idx = state.videos.findIndex((v) => v.id === action.payload.id);
      if (idx !== -1) {
        state.videos[idx] = action.payload;
      }
    },
    deleteVideo: (state, action: PayloadAction<string>) => {
      state.videos = state.videos.filter((v) => v.id !== action.payload);
    },

    // ------------------------------------------
    // PATIENT EDUCATION
    // ------------------------------------------
    addPatientEducation: (state, action: PayloadAction<PatientEducationItem>) => {
      state.patientEducation.unshift(action.payload);
    },
    updatePatientEducation: (state, action: PayloadAction<PatientEducationItem>) => {
      const idx = state.patientEducation.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) {
        state.patientEducation[idx] = {
          ...action.payload,
          version: state.patientEducation[idx].version + 1,
          updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        };
      }
    },
    deletePatientEducation: (state, action: PayloadAction<string>) => {
      state.patientEducation = state.patientEducation.filter((e) => e.id !== action.payload);
    },
    incrementDispatchCount: (state, action: PayloadAction<{ id: string; count?: number }>) => {
      const item = state.patientEducation.find((e) => e.id === action.payload.id);
      if (item) {
        item.dispatchCount = (item.dispatchCount || 0) + (action.payload.count || 1);
      }
    },

    // ------------------------------------------
    // DOCTOR CONTENT
    // ------------------------------------------
    addDoctorContent: (state, action: PayloadAction<DoctorContentItem>) => {
      state.doctorContent.unshift(action.payload);
    },
    updateDoctorContent: (state, action: PayloadAction<DoctorContentItem>) => {
      const idx = state.doctorContent.findIndex((d) => d.id === action.payload.id);
      if (idx !== -1) {
        state.doctorContent[idx] = action.payload;
      }
    },
    deleteDoctorContent: (state, action: PayloadAction<string>) => {
      state.doctorContent = state.doctorContent.filter((d) => d.id !== action.payload);
    },

    // ------------------------------------------
    // DEPARTMENT CONTENT
    // ------------------------------------------
    addDepartmentContent: (state, action: PayloadAction<DepartmentContentItem>) => {
      state.departmentContent.unshift(action.payload);
    },
    updateDepartmentContent: (state, action: PayloadAction<DepartmentContentItem>) => {
      const idx = state.departmentContent.findIndex((d) => d.id === action.payload.id);
      if (idx !== -1) {
        state.departmentContent[idx] = action.payload;
      }
    },
    deleteDepartmentContent: (state, action: PayloadAction<string>) => {
      state.departmentContent = state.departmentContent.filter((d) => d.id !== action.payload);
    },

    // ------------------------------------------
    // CLINICAL REVIEW & GOVERNANCE
    // ------------------------------------------
    submitForClinicalReview: (
      state,
      action: PayloadAction<{ id: string; category: ContentCategory }>
    ) => {
      const { id, category } = action.payload;
      if (category === "Articles") {
        const item = state.articles.find((a) => a.id === id);
        if (item) item.status = "In Review";
      } else if (category === "Videos") {
        const item = state.videos.find((v) => v.id === id);
        if (item) item.status = "In Review";
      } else if (category === "Patient Education") {
        const item = state.patientEducation.find((e) => e.id === id);
        if (item) item.status = "In Review";
      } else if (category === "Doctor Content") {
        const item = state.doctorContent.find((d) => d.id === id);
        if (item) item.status = "In Review";
      } else if (category === "Department Content") {
        const item = state.departmentContent.find((d) => d.id === id);
        if (item) item.status = "In Review";
      }
    },

    approveClinicalReview: (
      state,
      action: PayloadAction<{
        id: string;
        category: ContentCategory;
        review: ClinicalReviewRecord;
      }>
    ) => {
      const { id, category, review } = action.payload;
      if (category === "Articles") {
        const item = state.articles.find((a) => a.id === id);
        if (item) {
          item.status = "Approved";
          item.clinicalReview = review;
        }
      } else if (category === "Videos") {
        const item = state.videos.find((v) => v.id === id);
        if (item) {
          item.status = "Approved";
          item.clinicalReview = review;
        }
      } else if (category === "Patient Education") {
        const item = state.patientEducation.find((e) => e.id === id);
        if (item) {
          item.status = "Approved";
          item.clinicalReview = review;
        }
      } else if (category === "Doctor Content") {
        const item = state.doctorContent.find((d) => d.id === id);
        if (item) {
          item.status = "Approved";
          item.clinicalReview = review;
        }
      } else if (category === "Department Content") {
        const item = state.departmentContent.find((d) => d.id === id);
        if (item) {
          item.status = "Approved";
          item.clinicalReview = review;
        }
      }
    },

    rejectClinicalReview: (
      state,
      action: PayloadAction<{
        id: string;
        category: ContentCategory;
        review: ClinicalReviewRecord;
      }>
    ) => {
      const { id, category, review } = action.payload;
      if (category === "Articles") {
        const item = state.articles.find((a) => a.id === id);
        if (item) {
          item.status = "Rejected";
          item.clinicalReview = review;
        }
      } else if (category === "Videos") {
        const item = state.videos.find((v) => v.id === id);
        if (item) {
          item.status = "Rejected";
          item.clinicalReview = review;
        }
      } else if (category === "Patient Education") {
        const item = state.patientEducation.find((e) => e.id === id);
        if (item) {
          item.status = "Rejected";
          item.clinicalReview = review;
        }
      } else if (category === "Doctor Content") {
        const item = state.doctorContent.find((d) => d.id === id);
        if (item) {
          item.status = "Rejected";
          item.clinicalReview = review;
        }
      } else if (category === "Department Content") {
        const item = state.departmentContent.find((d) => d.id === id);
        if (item) {
          item.status = "Rejected";
          item.clinicalReview = review;
        }
      }
    },

    publishToPublicPortal: (
      state,
      action: PayloadAction<{ id: string; category: ContentCategory }>
    ) => {
      const { id, category } = action.payload;
      if (category === "Articles") {
        const item = state.articles.find((a) => a.id === id);
        if (item && item.status === "Approved") {
          item.status = "Published";
          item.publishedToPublic = true;
          item.hospitalProfileSynced = true;
        }
      } else if (category === "Videos") {
        const item = state.videos.find((v) => v.id === id);
        if (item && (item.status === "Approved" || !item.requiresClinicalReview)) {
          item.status = "Published";
          item.publishedToPublic = true;
        }
      } else if (category === "Patient Education") {
        const item = state.patientEducation.find((e) => e.id === id);
        if (item && item.status === "Approved") {
          item.status = "Published";
        }
      } else if (category === "Doctor Content") {
        const item = state.doctorContent.find((d) => d.id === id);
        if (item && item.status === "Approved") {
          item.status = "Published";
          item.syncedWithDoctorBio = true;
        }
      } else if (category === "Department Content") {
        const item = state.departmentContent.find((d) => d.id === id);
        if (item && item.status === "Approved") {
          item.status = "Published";
          item.syncedWithDepartmentCuration = true;
        }
      }
    },
  },
});

export const {
  hydrateContentResourcesState,
  addArticle,
  updateArticle,
  archiveArticle,
  deleteArticle,
  addVideo,
  updateVideo,
  deleteVideo,
  addPatientEducation,
  updatePatientEducation,
  deletePatientEducation,
  incrementDispatchCount,
  addDoctorContent,
  updateDoctorContent,
  deleteDoctorContent,
  addDepartmentContent,
  updateDepartmentContent,
  deleteDepartmentContent,
  submitForClinicalReview,
  approveClinicalReview,
  rejectClinicalReview,
  publishToPublicPortal,
} = contentResourcesSlice.actions;

export default contentResourcesSlice.reducer;

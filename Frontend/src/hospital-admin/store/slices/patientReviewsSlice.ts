import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  PatientReviewItem,
  NPSSurveyResponse,
  GrievanceCase,
  DoctorScorecard,
  DepartmentScorecard,
  ReviewAnalyticsSummary,
} from "@/hospital-admin/lib/types/patient-reviews";
import {
  mockPatientReviews,
  mockNpsSurveyResponses,
  mockGrievanceCases,
  mockDoctorScorecards,
  mockDepartmentScorecards,
  mockReviewAnalyticsSummary,
} from "@/hospital-admin/lib/mock-data/patient-reviews";

export interface PatientReviewsState {
  reviews: PatientReviewItem[];
  npsResponses: NPSSurveyResponse[];
  grievances: GrievanceCase[];
  doctorScorecards: DoctorScorecard[];
  departmentScorecards: DepartmentScorecard[];
  analytics: ReviewAnalyticsSummary;
  isSyncingGoogle: boolean;
  lastSyncedAt: string;
}

const initialState: PatientReviewsState = {
  reviews: mockPatientReviews,
  npsResponses: mockNpsSurveyResponses,
  grievances: mockGrievanceCases,
  doctorScorecards: mockDoctorScorecards,
  departmentScorecards: mockDepartmentScorecards,
  analytics: mockReviewAnalyticsSummary,
  isSyncingGoogle: false,
  lastSyncedAt: "2026-08-30 14:00",
};

export const patientReviewsSlice = createSlice({
  name: "patientReviews",
  initialState,
  reducers: {
    hydratePatientReviewsState: (state, action: PayloadAction<Partial<PatientReviewsState>>) => {
      if (action.payload.reviews) state.reviews = action.payload.reviews;
      if (action.payload.npsResponses) state.npsResponses = action.payload.npsResponses;
      if (action.payload.grievances) state.grievances = action.payload.grievances;
      if (action.payload.doctorScorecards) state.doctorScorecards = action.payload.doctorScorecards;
      if (action.payload.departmentScorecards) state.departmentScorecards = action.payload.departmentScorecards;
      if (action.payload.analytics) state.analytics = action.payload.analytics;
      if (typeof action.payload.isSyncingGoogle === "boolean") state.isSyncingGoogle = action.payload.isSyncingGoogle;
      if (action.payload.lastSyncedAt) state.lastSyncedAt = action.payload.lastSyncedAt;
    },

    respondToReview: (
      state,
      action: PayloadAction<{
        reviewId: string;
        responseText: string;
        respondedBy: string;
      }>
    ) => {
      const { reviewId, responseText, respondedBy } = action.payload;
      const review = state.reviews.find((r) => r.id === reviewId);
      if (review) {
        review.responded = true;
        review.responseText = responseText;
        review.respondedBy = respondedBy;
        review.respondedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
      }
      // Update unanswered count in analytics
      state.analytics.unansweredCount = state.reviews.filter((r) => !r.responded).length;
    },

    linkReviewToDoctorOrDept: (
      state,
      action: PayloadAction<{
        reviewId: string;
        doctorId?: string | null;
        doctorName?: string | null;
        departmentId?: string | null;
        departmentName?: string | null;
      }>
    ) => {
      const { reviewId, doctorId, doctorName, departmentId, departmentName } = action.payload;
      const review = state.reviews.find((r) => r.id === reviewId);
      if (review) {
        if (doctorId !== undefined) {
          review.linkedDoctorId = doctorId;
          review.linkedDoctorName = doctorName;
        }
        if (departmentId !== undefined) {
          review.linkedDepartmentId = departmentId;
          review.linkedDepartmentName = departmentName;
        }
      }
    },

    escalateReviewToGrievance: (
      state,
      action: PayloadAction<{
        reviewId: string;
        patientId?: string;
        patientName?: string;
        patientPhone?: string;
        category: GrievanceCase["category"];
        severity: GrievanceCase["severity"];
        escalationTier: GrievanceCase["escalationTier"];
        assignedTo: string;
        description: string;
      }>
    ) => {
      const {
        reviewId,
        patientId = "UHID-EXT-000",
        patientName = "Reviewer",
        patientPhone = "+91 90000 00000",
        category,
        severity,
        escalationTier,
        assignedTo,
        description,
      } = action.payload;

      const review = state.reviews.find((r) => r.id === reviewId);
      const caseId = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      if (review) {
        review.isEscalatedToGrievance = true;
        review.grievanceCaseId = caseId;
      }

      const newCase: GrievanceCase = {
        id: caseId,
        patientId: review?.patientId || patientId,
        patientName: review?.patientName || patientName,
        patientPhone,
        category,
        description,
        sourceReviewId: reviewId,
        severity,
        escalationTier,
        assignedTo,
        status: "Open",
        createdAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        slaDeadline: new Date(Date.now() + 24 * 3600 * 1000)
          .toISOString()
          .replace("T", " ")
          .substring(0, 16),
        isOverdue: false,
        patientCallbackConfirmed: false,
      };

      state.grievances.unshift(newCase);
      state.analytics.activeGrievancesCount = state.grievances.filter(
        (g) => g.status !== "Resolved"
      ).length;
    },

    createGrievanceCase: (state, action: PayloadAction<GrievanceCase>) => {
      state.grievances.unshift(action.payload);
      state.analytics.activeGrievancesCount = state.grievances.filter(
        (g) => g.status !== "Resolved"
      ).length;
    },

    escalateGrievanceTier: (
      state,
      action: PayloadAction<{
        caseId: string;
        targetTier: GrievanceCase["escalationTier"];
        reassignedTo: string;
      }>
    ) => {
      const gCase = state.grievances.find((g) => g.id === action.payload.caseId);
      if (gCase) {
        gCase.escalationTier = action.payload.targetTier;
        gCase.assignedTo = action.payload.reassignedTo;
        gCase.status = "Escalated";
      }
    },

    resolveGrievanceCase: (
      state,
      action: PayloadAction<{
        caseId: string;
        resolutionNotes: string;
        resolvedBy: string;
        patientCallbackConfirmed: boolean;
      }>
    ) => {
      const gCase = state.grievances.find((g) => g.id === action.payload.caseId);
      if (gCase) {
        gCase.status = "Resolved";
        gCase.resolutionNotes = action.payload.resolutionNotes;
        gCase.resolvedBy = action.payload.resolvedBy;
        gCase.patientCallbackConfirmed = action.payload.patientCallbackConfirmed;
        gCase.resolvedAt = new Date().toISOString().replace("T", " ").substring(0, 16);
      }
      state.analytics.activeGrievancesCount = state.grievances.filter(
        (g) => g.status !== "Resolved"
      ).length;
    },

    addNpsSurveyResponse: (state, action: PayloadAction<NPSSurveyResponse>) => {
      state.npsResponses.unshift(action.payload);

      // If user also submitted feedback text, create an internal review item
      if (action.payload.feedbackText && action.payload.feedbackText.trim().length > 0) {
        const starRating = Math.max(1, Math.min(5, Math.round(action.payload.score / 2)));
        const newReview: PatientReviewItem = {
          id: `rev-nps-${Date.now()}`,
          source: "Post-Discharge Survey",
          patientId: action.payload.patientId,
          patientName: action.payload.patientName,
          rating: starRating,
          reviewText: action.payload.feedbackText,
          submittedAt: action.payload.submittedAt,
          responded: false,
          linkedDepartmentName: action.payload.departmentName,
          linkedDoctorName: action.payload.doctorName,
          sentiment:
            action.payload.category === "Promoter"
              ? "Positive"
              : action.payload.category === "Passive"
              ? "Neutral"
              : "Negative",
          tags: ["Post-Discharge Survey", action.payload.departmentName],
        };
        state.reviews.unshift(newReview);
      }

      // Recalculate NPS metrics
      const total = state.npsResponses.length;
      const promoters = state.npsResponses.filter((r) => r.category === "Promoter").length;
      const passives = state.npsResponses.filter((r) => r.category === "Passive").length;
      const detractors = state.npsResponses.filter((r) => r.category === "Detractor").length;

      const pPercent = Math.round((promoters / total) * 100);
      const passPercent = Math.round((passives / total) * 100);
      const dPercent = Math.round((detractors / total) * 100);

      state.analytics.npsScore = pPercent - dPercent;
      state.analytics.npsPromotersPercent = pPercent;
      state.analytics.npsPassivesPercent = passPercent;
      state.analytics.npsDetractorsPercent = dPercent;
    },

    syncGoogleReviewsStart: (state) => {
      state.isSyncingGoogle = true;
    },

    syncGoogleReviewsSuccess: (state) => {
      state.isSyncingGoogle = false;
      state.lastSyncedAt = new Date().toISOString().replace("T", " ").substring(0, 16);

      // Add a simulated new Google review
      const newReview: PatientReviewItem = {
        id: `rev-google-synced-${Date.now()}`,
        source: "Google",
        patientName: "Dr. Aniruddh Kothari",
        rating: 5,
        reviewText:
          "Visited for a health checkup package. Phlebotomist in the lab was very skilled with zero pain. Reports arrived on WhatsApp within 3 hours.",
        submittedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        responded: false,
        linkedDepartmentId: "dept-lab",
        linkedDepartmentName: "Laboratory & Diagnostics",
        sentiment: "Positive",
        tags: ["Laboratory", "Health Checkup", "Report Turnaround"],
        googleReviewUrl: "https://maps.google.com/?cid=qlyno-hospital",
      };

      state.reviews.unshift(newReview);
      state.analytics.totalReviewsCount += 1;
      state.analytics.unansweredCount += 1;
    },
  },
});

export const {
  hydratePatientReviewsState,
  respondToReview,
  linkReviewToDoctorOrDept,
  escalateReviewToGrievance,
  createGrievanceCase,
  escalateGrievanceTier,
  resolveGrievanceCase,
  addNpsSurveyResponse,
  syncGoogleReviewsStart,
  syncGoogleReviewsSuccess,
} = patientReviewsSlice.actions;

export default patientReviewsSlice.reducer;

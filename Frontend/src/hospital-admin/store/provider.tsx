"use client";

import { useEffect, useRef } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import {
  getBackendAmbulanceState,
  getBackendContentResourcesState,
  getBackendDocumentsState,
  getBackendEmergencyState,
  getBackendHospitalProfileState,
  getBackendPatientReviewsState,
  getBackendSurgicalState,
  getBackendWardsBedsState,
  getHmsAuthSession,
} from "@/hospital-admin/lib/hms-api";
import { hydrateAmbulanceState } from "./slices/ambulanceSlice";
import { hydrateContentResourcesState } from "./slices/contentResourcesSlice";
import { hydrateDocumentsState } from "./slices/documentsSlice";
import { hydrateEmergencyState } from "./slices/emergencySlice";
import { hydrateHospitalProfileState } from "./slices/hospitalProfileSlice";
import { hydrateNursingOperations } from "./slices/nursingOperationsSlice";
import { hydratePatientReviewsState } from "./slices/patientReviewsSlice";
import { hydrateSurgicalState } from "./slices/surgicalSlice";
import { hydrateWardsBedsState } from "./slices/wardsBedsSlice";
import { AppDispatch, RootState, store } from "./store";

export const NURSING_STORAGE_KEY = "qlyno.nursing-operations.v1";

function NursingStatePersistence() {
  const dispatch = useDispatch();
  const nursingOperations = useSelector((state: RootState) => state.nursingOperations);
  const isHydratedRef = useRef(false);

  // 1. Initial hydration on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(NURSING_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && parsed.currentRole) {
            dispatch(hydrateNursingOperations(parsed));
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load nursing state from storage:", e);
    } finally {
      // Allow state hydration to apply to Redux before enabling localStorage writes
      setTimeout(() => {
        isHydratedRef.current = true;
      }, 150);
    }
  }, [dispatch]);

  // 2. Persist state changes only AFTER hydration completes
  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(NURSING_STORAGE_KEY, JSON.stringify(nursingOperations));
      }
    } catch (e) {
      console.warn("Failed to save nursing state to storage:", e);
    }
  }, [nursingOperations]);

  return null;
}

function HmsBackendHydration() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!getHmsAuthSession()) return;

    let cancelled = false;

    async function hydrateBackendState() {
      const results = await Promise.allSettled([
        getBackendAmbulanceState(),
        getBackendWardsBedsState(),
        getBackendEmergencyState(),
        getBackendSurgicalState(),
        getBackendDocumentsState(),
        getBackendHospitalProfileState(),
        getBackendContentResourcesState(),
        getBackendPatientReviewsState(),
      ]);

      if (cancelled) return;

      const [ambulance, wardsBeds, emergency, surgical, documents, hospitalProfile, contentResources, patientReviews] = results;

      if (ambulance.status === "fulfilled") {
        dispatch(hydrateAmbulanceState({ fleet: ambulance.value.fleet, dispatchHistory: ambulance.value.dispatchHistory }));
      }
      if (wardsBeds.status === "fulfilled") dispatch(hydrateWardsBedsState(wardsBeds.value));
      if (emergency.status === "fulfilled") dispatch(hydrateEmergencyState(emergency.value));
      if (surgical.status === "fulfilled") dispatch(hydrateSurgicalState(surgical.value));
      if (documents.status === "fulfilled") dispatch(hydrateDocumentsState(documents.value));
      if (hospitalProfile.status === "fulfilled") dispatch(hydrateHospitalProfileState(hospitalProfile.value));
      if (contentResources.status === "fulfilled") dispatch(hydrateContentResourcesState(contentResources.value));
      if (patientReviews.status === "fulfilled") dispatch(hydratePatientReviewsState(patientReviews.value));

      results.forEach((result) => {
        if (result.status === "rejected") {
          console.warn("Failed to hydrate HMS backend state:", result.reason);
        }
      });
    }

    void hydrateBackendState();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <NursingStatePersistence />
      <HmsBackendHydration />
      {children}
    </Provider>
  );
}

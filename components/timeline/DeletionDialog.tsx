"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const REMEMBER_DELETE_CHOICE_KEY = "clipcap-remember-delete-choice";
const REMEMBER_DELETE_VALUE_KEY = "clipcap-remember-delete-value";

export type DeletionType = "subtitle" | "video";

interface DeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DeletionType;
  onConfirm: (deleteVideo: boolean) => void;
  onCancel: () => void;
}

export const DeletionDialog: React.FC<DeletionDialogProps> = ({
  open,
  onOpenChange,
  type,
  onConfirm,
  onCancel,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleConfirm = (deleteVideo: boolean) => {
    if (rememberChoice && typeof window !== "undefined") {
      localStorage.setItem(REMEMBER_DELETE_CHOICE_KEY, "true");
      localStorage.setItem(REMEMBER_DELETE_VALUE_KEY, String(deleteVideo));
    }
    onConfirm(deleteVideo);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const isSubtitle = type === "subtitle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSubtitle ? "Delete Subtitle" : "Delete Video Segment"}
          </DialogTitle>
          <DialogDescription>
            {isSubtitle ? (
              <>
                Do you want to delete only the subtitle (video continues) or
                delete both the subtitle and the corresponding video segment?
              </>
            ) : (
              <>This will remove the video segment and close the gap.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {isSubtitle && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleConfirm(false)}
              >
                Subtitle only
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleConfirm(true)}
              >
                Subtitle + Video
              </Button>
            </div>
          )}
          {!isSubtitle && (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => handleConfirm(true)}>
                Delete
              </Button>
            </div>
          )}

          {isSubtitle && (
            <div className="flex items-center space-x-2">
              <Switch
                id="remember-delete"
                checked={rememberChoice}
                onCheckedChange={setRememberChoice}
              />
              <Label htmlFor="remember-delete" className="text-sm">
                Remember my choice
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Get stored preference for delete behavior (subtitle only vs subtitle+video). Returns null if no preference. */
export function getStoredDeletePreference(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(REMEMBER_DELETE_CHOICE_KEY);
  if (stored !== "true") return null;
  const value = localStorage.getItem(REMEMBER_DELETE_VALUE_KEY);
  return value === "true" ? true : value === "false" ? false : null;
}

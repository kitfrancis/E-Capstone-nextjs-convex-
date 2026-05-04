"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageSquare, X } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  fileUrl: string;
  fileName: string;
  deliverableId?: Id<"deliverables">;
  userId?: string;
  userName?: string;
  open: boolean;
  onClose: () => void;
}

export function PDFViewer({ fileUrl, fileName, deliverableId, userId, userName, open, onClose }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(500);
  const [commentMode, setCommentMode] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentPosition, setCommentPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const comments = useQuery(
    api.dashboard.getPdfComments,
    deliverableId ? { deliverableId } : "skip"
  );
  const addComment = useMutation(api.dashboard.addPdfComment);
  const deleteComment = useMutation(api.dashboard.deletePdfComment);

  useEffect(() => {
    if (!open) return;

    // reset on open
    setPageNumber(1);
    setNumPages(0);
    setCommentMode(false);
    setNewComment("");
    setCommentPosition(null);

    const updateWidth = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.clientWidth - 32);
      }
    };

    // small delay to let dialog render first
    const timeout = setTimeout(updateWidth, 50);
    window.addEventListener("resize", updateWidth);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateWidth);
    };
  }, [open]);

  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!commentMode || !deliverableId || !userId || !userName) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setCommentPosition({ x, y });
  };

  const handleAddComment = async () => {
    if (!deliverableId || !userId || !userName || !commentPosition || !newComment.trim()) return;

    await addComment({
      deliverableId,
      userId,
      userName,
      comment: newComment.trim(),
      pageNumber,
      x: commentPosition.x,
      y: commentPosition.y,
    });

    setNewComment("");
    setCommentPosition(null);
    setCommentMode(false);
  };

  const handleDeleteComment = async (commentId: Id<"pdfComments">) => {
    await deleteComment({ commentId });
  };

  const currentPageComments = comments?.filter(c => c.pageNumber === pageNumber) || [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm truncate pr-6">{fileName}</DialogTitle>
            {deliverableId && userId && (
              <Button
                variant={commentMode ? "default" : "outline"}
                size="sm"
                onClick={() => setCommentMode(!commentMode)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {commentMode ? "Cancel Comment" : "Add Comment"}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex flex-col items-center p-4 bg-muted/30 min-h-0"
        >
          {!fileUrl ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              }
              error={
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-destructive">Failed to load PDF.</p>
                </div>
              }
              className="flex flex-col items-center w-full "
            >
              <div className="relative" onClick={handlePageClick}>
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                {currentPageComments.map((comment) => (
                  <div
                    key={comment._id}
                    className="absolute bg-yellow-200 border border-yellow-400 rounded p-2 shadow-lg max-w-xs"
                    style={{
                      left: `${comment.x}%`,
                      top: `${comment.y}%`,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-800">{comment.userName}</p>
                        <p className="text-sm text-gray-700">{comment.comment}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {userId === comment.userId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(comment._id);
                          }}
                          className="h-6 w-6 p-0 hover:bg-red-100"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {commentMode && commentPosition && (
                  <div
                    className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"
                    style={{
                      left: `${commentPosition.x}%`,
                      top: `${commentPosition.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                )}
              </div>
            </Document>
          )}
        </div>

        {numPages > 0 && (
          <div className="flex gap-3 items-center justify-center border-t px-4 py-3 bg-background shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              {pageNumber} / {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber(p => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {commentMode && commentPosition && (
          <div className="flex gap-2 items-center border-t px-4 py-3 bg-background shrink-0">
            <Input
              placeholder="Enter your comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newComment.trim()) {
                  handleAddComment();
                } else if (e.key === 'Escape') {
                  setCommentMode(false);
                  setCommentPosition(null);
                  setNewComment("");
                }
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
            >
              Add Comment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCommentMode(false);
                setCommentPosition(null);
                setNewComment("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
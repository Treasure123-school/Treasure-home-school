/**
 * Handles PDF / image export and print for a report card.
 * Owns the off-screen template ref, isDownloading flag, and the three handlers.
 * Extracted so the page hook stays under the 150-line target.
 */
import { useState, useRef } from 'react';
import { exportToPDF, exportToImage, printElement } from '@/lib/report-export-utils';
import { useToast } from '@/hooks/use-toast';

type GetReportCard = () => any;
type GetTemplate   = () => HTMLDivElement | null;

export function useReportCardExport(getReportCard: GetReportCard, getTemplate: GetTemplate) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleExportPDF = async () => {
    const el = getTemplate();
    if (!el || !getReportCard()) return;
    setIsDownloading(true);
    try {
      await exportToPDF(el, { filename: `report-card-${getReportCard()?.studentName?.replace(/\s+/g, '-') || 'student'}`, scale: 2 });
      toast({ title: 'Success', description: 'Report card PDF downloaded' });
    } catch (e: any) {
      toast({ title: 'Download Failed', description: e?.message || 'Could not download PDF.', variant: 'destructive' });
    } finally { setIsDownloading(false); }
  };

  const handleExportImage = async () => {
    const el = getTemplate();
    if (!el || !getReportCard()) return;
    setIsDownloading(true);
    try {
      await exportToImage(el, { filename: `report-card-${getReportCard()?.studentName?.replace(/\s+/g, '-') || 'student'}`, scale: 2 });
      toast({ title: 'Success', description: 'Report card downloaded as image' });
    } catch (e: any) {
      toast({ title: 'Download Failed', description: e?.message || 'Could not download image.', variant: 'destructive' });
    } finally { setIsDownloading(false); }
  };

  const handlePrint = (templateRef: HTMLDivElement | null) =>
    templateRef ? printElement(templateRef) : window.print();

  return { isDownloading, handleExportPDF, handleExportImage, handlePrint };
}

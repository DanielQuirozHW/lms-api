import { Injectable } from '@nestjs/common';
import * as React from 'react';
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

export interface CertificatePdfData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  finalGrade: number | null;
  issuedAt: Date;
  certificateCode: string;
  courseSlug: string;
}

// Register a serif font-family name so react-pdf falls back to Helvetica
// (default built-in). Swapping to a real font requires providing a TTF URL.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#1A1523',
    padding: 48,
    fontFamily: 'Helvetica',
  },
  border: {
    border: '3pt solid #4A7FD4',
    borderRadius: 8,
    padding: 40,
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 13,
    color: '#4A7FD4',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  heading: {
    fontSize: 11,
    color: '#8B9ABF',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  studentName: {
    fontSize: 34,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  courseLabel: {
    fontSize: 11,
    color: '#8B9ABF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 28,
    textAlign: 'center',
  },
  divider: {
    width: 80,
    height: 2,
    backgroundColor: '#4A7FD4',
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 28,
  },
  metaBlock: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 9,
    color: '#8B9ABF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  codeLabel: {
    fontSize: 9,
    color: '#4A7FD4',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  codeValue: {
    fontSize: 10,
    color: '#8B9ABF',
    marginTop: 4,
  },
});

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    date,
  );
}

@Injectable()
export class CertificatePdfService {
  async generate(data: CertificatePdfData): Promise<Buffer> {
    const gradeRow = React.createElement(
      View,
      { style: styles.metaBlock },
      React.createElement(Text, { style: styles.metaLabel }, 'Calificación'),
      React.createElement(
        Text,
        { style: styles.metaValue },
        data.finalGrade !== null ? String(Math.round(data.finalGrade)) : 'Aprobado',
      ),
    );

    const instructorRow = React.createElement(
      View,
      { style: styles.metaBlock },
      React.createElement(Text, { style: styles.metaLabel }, 'Instructor'),
      React.createElement(Text, { style: styles.metaValue }, data.instructorName),
    );

    const dateRow = React.createElement(
      View,
      { style: styles.metaBlock },
      React.createElement(Text, { style: styles.metaLabel }, 'Fecha de emisión'),
      React.createElement(Text, { style: styles.metaValue }, formatDate(data.issuedAt)),
    );

    const doc = React.createElement(
      Document,
      { title: `Certificado — ${data.courseTitle}` },
      React.createElement(
        Page,
        { size: 'A4', orientation: 'landscape', style: styles.page },
        React.createElement(
          View,
          { style: styles.border },
          React.createElement(Text, { style: styles.logo }, 'NexusLMS'),
          React.createElement(Text, { style: styles.heading }, 'Certificado de finalización'),
          React.createElement(Text, { style: styles.studentName }, data.studentName),
          React.createElement(
            Text,
            { style: styles.courseLabel },
            'Ha completado satisfactoriamente',
          ),
          React.createElement(Text, { style: styles.courseTitle }, data.courseTitle),
          React.createElement(View, { style: styles.divider }),
          React.createElement(View, { style: styles.metaRow }, gradeRow, instructorRow, dateRow),
          React.createElement(Text, { style: styles.codeLabel }, 'ID del certificado'),
          React.createElement(Text, { style: styles.codeValue }, data.certificateCode),
        ),
      ),
    );

    return renderToBuffer(doc);
  }
}

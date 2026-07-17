import mongoose from 'mongoose';

const IssueSchema = new mongoose.Schema({
  category: String, severity: { type: String, enum: ['high', 'medium', 'low'] }, title: String,
  description: String, businessImpact: String, fixSuggestion: String, fixSnippet: String,
  quickWin: Boolean, resolved: { type: Boolean, default: false }
}, { _id: true });

const category = { score: Number, issues: [IssueSchema] };
const AuditSchema = new mongoose.Schema({
  url: String, createdAt: { type: Date, default: Date.now }, status: { type: String, default: 'pending' },
  error: String, overallScore: Number,
  categories: { performance: category, seo: category, accessibility: category, mobile: category },
  pageText: String,
  vibeCheck: { tone: String, summary: String, sampleRewrite: String },
  competitorComparison: { competitorUrl: String, metrics: mongoose.Schema.Types.Mixed, battleCard: [{ type: String, text: String }] }
});
export default mongoose.model('Audit', AuditSchema);

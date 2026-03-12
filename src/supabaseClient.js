import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const authHelpers = {
  async signUp(email, password, userData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },

  async getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }
}

// Database helpers
export const dbHelpers = {
  // Temas
  async getThemes(userId) {
    const { data, error } = await supabase
      .from('themes')
      .select('*, documents(*), questions(*)')
      .eq('user_id', userId)
      .order('number', { ascending: true })
    return { data, error }
  },

  async createTheme(userId, themeData) {
    const { data, error } = await supabase
      .from('themes')
      .insert({
        user_id: userId,
        ...themeData
      })
      .select()
      .single()
    return { data, error }
  },

  async createThemesBatch(userId, themesData) {
    const { data, error } = await supabase
      .from('themes')
      .insert(themesData.map(t => ({ user_id: userId, number: t.number, name: t.name })))
      .select()
    return { data, error }
  },

  async updateTheme(themeId, updates) {
    const { data, error } = await supabase
      .from('themes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', themeId)
      .select()
      .single()
    return { data, error }
  },

  async deleteTheme(themeId) {
    const { error } = await supabase
      .from('themes')
      .delete()
      .eq('id', themeId)
    return { error }
  },

  // Documentos
  async addDocument(themeId, documentData) {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        theme_id: themeId,
        ...documentData
      })
      .select()
      .single()
    return { data, error }
  },

  async deleteDocument(documentId) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
    return { error }
  },

  // Preguntas
  async addQuestions(themeId, questions) {
    const { data, error} = await supabase
      .from('questions')
      .insert(
        questions.map(q => ({
          theme_id: themeId,
          text: q.text,
          options: q.options,
          correct_answer: q.correct,
          difficulty: q.difficulty || 'media',
          explanation: q.explanation || null
        }))
      )
      .select()
    return { data, error }
  },

  async updateQuestion(questionId, updates) {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', questionId)
      .select()
      .single()
    return { data, error }
  },

  async deleteQuestions(questionIds) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .in('id', questionIds)
    return { error }
  },

  // Tests (colecciones de temas)
  async getTests(userId) {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    return { data, error }
  },

  async createTest(userId, name) {
    const { data, error } = await supabase
      .from('tests')
      .insert({ user_id: userId, name })
      .select()
      .single()
    return { data, error }
  },

  async updateTest(testId, name) {
    const { data, error } = await supabase
      .from('tests')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', testId)
      .select()
      .single()
    return { data, error }
  },

  async deleteTest(testId) {
    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId)
    return { error }
  },

  async getThemesByTest(testId) {
    const { data, error } = await supabase
      .from('themes')
      .select('*, documents(*), questions(*)')
      .eq('test_id', testId)
      .order('number', { ascending: true })
    return { data, error }
  },

  async getOrphanThemes(userId) {
    const { data, error } = await supabase
      .from('themes')
      .select('id')
      .eq('user_id', userId)
      .is('test_id', null)
      .limit(1)
    return { data, error }
  },

  async migrateThemesToTest(userId, testId) {
    const { error } = await supabase
      .from('themes')
      .update({ test_id: testId })
      .eq('user_id', userId)
      .is('test_id', null)
    return { error }
  },

  async createThemesBatchForTest(userId, testId, themes) {
    const { data, error } = await supabase
      .from('themes')
      .insert(themes.map(t => ({ user_id: userId, test_id: testId, number: t.number, name: t.name })))
      .select()
    return { data, error }
  },

  // Historial de exámenes
  async saveExamResult(userId, config, score) {
    const { data, error } = await supabase
      .from('exam_history')
      .insert({
        user_id: userId,
        config,
        score
      })
      .select()
      .single()
    return { data, error }
  },

  async getExamHistory(userId) {
    const { data, error } = await supabase
      .from('exam_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data, error }
  }
}

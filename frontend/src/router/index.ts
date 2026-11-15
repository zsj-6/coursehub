import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/auth/Login.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/home/Dashboard.vue') },
        { path: 'courses', name: 'my-courses', component: () => import('@/views/course/MyCourses.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/views/profile/Profile.vue') },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/views/admin/Users.vue'),
          meta: { admin: true },
        },
      ],
    },
    {
      path: '/courses/:courseId(\\d+)',
      component: () => import('@/layouts/CourseLayout.vue'),
      props: (r) => ({ courseId: Number(r.params.courseId) }),
      children: [
        { path: '', name: 'course-content', component: () => import('@/views/course/CourseContent.vue') },
        {
          path: 'homework',
          name: 'course-homework',
          component: () => import('@/views/course/ActivityList.vue'),
          props: { type: 'homework' },
        },
        {
          path: 'exams',
          name: 'course-exams',
          component: () => import('@/views/course/ActivityList.vue'),
          props: { type: 'exam' },
        },
        { path: 'grades', name: 'course-grades', component: () => import('@/views/course/Grades.vue') },
        { path: 'members', name: 'course-members', component: () => import('@/views/course/Members.vue') },
        { path: 'settings', name: 'course-settings', component: () => import('@/views/course/Settings.vue') },
        { path: 'announcements', name: 'course-announcements', component: () => import('@/views/course/Announcements.vue') },
        { path: 'analytics', name: 'course-analytics', component: () => import('@/views/course/Analytics.vue') },
        {
          path: 'activities/:activityId(\\d+)',
          name: 'activity',
          component: () => import('@/views/activity/ActivityPage.vue'),
          props: (r) => ({ activityId: Number(r.params.activityId) }),
        },
        {
          path: 'activities/:activityId(\\d+)/questions',
          name: 'questions',
          component: () => import('@/views/activity/QuestionEditor.vue'),
          props: (r) => ({ activityId: Number(r.params.activityId) }),
        },
        {
          path: 'submissions/:submissionId(\\d+)',
          name: 'submission',
          component: () => import('@/views/activity/SubmissionView.vue'),
          props: (r) => ({ submissionId: Number(r.params.submissionId) }),
        },
      ],
    },
    // PBL 项目训练原型（纯前端，数据见 src/mock/pbl.ts）
    {
      path: '/pbl',
      component: () => import('@/views/pbl/PblLayout.vue'),
      children: [
        { path: '', name: 'pbl-hall', component: () => import('@/views/pbl/Hall.vue') },
        { path: 'mine', name: 'pbl-mine', component: () => import('@/views/pbl/MyProjects.vue') },
        { path: 'showcase', name: 'pbl-showcase', component: () => import('@/views/pbl/Showcase.vue') },
        { path: 'stats', name: 'pbl-stats', component: () => import('@/views/pbl/Stats.vue') },
        {
          path: 'programs/:programId',
          name: 'pbl-program',
          component: () => import('@/views/pbl/ProgramDetail.vue'),
          props: true,
        },
        {
          path: 'projects/:projectId',
          name: 'pbl-project',
          component: () => import('@/views/pbl/ProjectDetail.vue'),
          props: true,
        },
        {
          path: 'projects/:projectId/teams/:teamId',
          name: 'pbl-team',
          component: () => import('@/views/pbl/TeamSpace.vue'),
          props: true,
        },
        {
          path: 'projects/:projectId/tasks/:taskId',
          name: 'pbl-task',
          component: () => import('@/views/pbl/TaskReview.vue'),
          props: true,
        },
      ],
    },
    // AI 原型：能力成长、知识图谱、闯关、AI 辅学、AI 助教、AI 办学（纯前端，数据见 src/mock/ai.ts）
    {
      path: '/units',
      component: () => import('@/views/ai/AiLayout.vue'),
      children: [
        { path: '', name: 'ai-units', component: () => import('@/views/ai/UnitList.vue') },
        { path: 'desk', name: 'ai-desk', component: () => import('@/views/ai/TeacherDesk.vue') },
        { path: 'today', name: 'ai-today', component: () => import('@/views/ai/Today.vue') },
        { path: 'tutor', name: 'ai-tutor', component: () => import('@/views/ai/Tutor.vue') },
        { path: 'agents', name: 'ai-agents', component: () => import('@/views/ai/Agents.vue') },
        { path: 'growth', name: 'ai-growth', component: () => import('@/views/ai/Growth.vue') },
        { path: 'mine', name: 'ai-mine', component: () => import('@/views/ai/Mine.vue') },
        { path: ':unitId', name: 'ai-unit', component: () => import('@/views/ai/UnitDetail.vue'), props: true },
        { path: ':unitId/read/:resId', name: 'ai-read', component: () => import('@/views/ai/Reader.vue'), props: true },
        { path: ':unitId/levels/:levelId', name: 'ai-level', component: () => import('@/views/ai/LevelRun.vue'), props: true },
        // 绝对路径挂在同一个布局下：在 /units 和 /insight 之间切换不会重新挂载布局，演示视角不会被重置
        { path: '/insight', name: 'ai-insight', component: () => import('@/views/ai/Insight.vue') },
      ],
    },
    // 全屏页面（不带课程菜单）
    {
      path: '/courses/:courseId(\\d+)/activities/:activityId(\\d+)/grade',
      name: 'homework-grade',
      component: () => import('@/views/activity/HomeworkGrade.vue'),
      props: (r) => ({
        courseId: Number(r.params.courseId),
        activityId: Number(r.params.activityId),
        userId: r.query.user ? Number(r.query.user) : undefined,
      }),
    },
    {
      path: '/courses/:courseId(\\d+)/activities/:activityId(\\d+)/take',
      name: 'exam-take',
      component: () => import('@/views/activity/ExamTake.vue'),
      props: (r) => ({ courseId: Number(r.params.courseId), activityId: Number(r.params.activityId) }),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const store = useUserStore()
  if (to.meta.public) return true
  if (!store.token) return { name: 'login', query: { redirect: to.fullPath } }
  if (!store.user) {
    try {
      await store.fetchMe()
    } catch {
      store.logout()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
  if (to.meta.admin && !store.isAdmin) return { name: 'home' }
  return true
})

export default router

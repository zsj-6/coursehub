import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { coursesApi } from '@/api/courses'
import type { Course } from '@/api/types'

/** 当前打开的课程，以及我在课程里的角色。 */
export const useCourseStore = defineStore('course', () => {
  const course = ref<Course | null>(null)
  const role = computed(() => course.value?.my_role ?? null)
  const isManager = computed(() => role.value === 'teacher')
  const canGrade = computed(() => role.value === 'teacher' || role.value === 'ta')
  const isStudent = computed(() => role.value === 'student')

  async function load(id: number) {
    course.value = await coursesApi.get(id)
  }

  return { course, role, isManager, canGrade, isStudent, load }
})

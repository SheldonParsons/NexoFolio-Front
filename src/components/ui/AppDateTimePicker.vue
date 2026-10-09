<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDateTime, parseDateTime, type DateValue } from '@internationalized/date'
import { CalendarDays, Clock3 } from '@lucide/vue'
import {
  DatePickerRoot,
  DatePickerField,
  DatePickerInput,
  DatePickerTrigger,
  DatePickerAnchor,
  DatePickerContent,
  DatePickerCalendar,
  DatePickerHeader,
  DatePickerHeading,
  DatePickerPrev,
  DatePickerNext,
  DatePickerGrid,
  DatePickerGridHead,
  DatePickerGridBody,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerCell,
  DatePickerCellTrigger,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import './app-date-time-picker.css'

defineProps<{ id: string; label: string; disabled?: boolean }>()
// Keep local wall-clock values at this boundary. The caller converts to UTC on submission.
const model = defineModel<string>({ required: true })
const current = new Date()
const placeholder = new CalendarDateTime(
  current.getFullYear(),
  current.getMonth() + 1,
  current.getDate(),
  current.getHours(),
  current.getMinutes(),
)
const value = computed<DateValue | undefined>({
  get() {
    try {
      return model.value ? parseDateTime(model.value) : undefined
    } catch {
      return undefined
    }
  },
  set(date) {
    model.value = date instanceof CalendarDateTime ? date.toString().slice(0, 16) : ''
  },
})
function splitSegments<T extends { part: string; value: string }>(segments: T[]) {
  const timeStart = segments.findIndex((segment) => segment.part === 'hour')
  return {
    date: segments.slice(0, timeStart).filter((segment) => segment.value.trim()),
    time: segments.slice(timeStart),
  }
}
</script>

<template>
  <div class="app-datetime">
    <label :id="`${id}-label`" :for="id">{{ label }}</label>
    <DatePickerRoot
      :id="id"
      v-model="value"
      :default-placeholder="placeholder"
      :disabled="disabled"
      locale="zh-CN"
      granularity="minute"
      :hour-cycle="24"
      :week-starts-on="1"
      weekday-format="short"
      fixed-weeks
      prevent-deselect
      close-on-select
      required
    >
      <DatePickerAnchor as-child>
        <DatePickerField
          v-slot="{ segments }"
          class="app-datetime-field"
          :aria-labelledby="`${id}-label`"
        >
          <div class="app-datetime-segments">
            <div class="app-datetime-date">
              <DatePickerInput
                v-for="(segment, index) in splitSegments(segments).date"
                :key="index"
                :part="segment.part"
                class="app-datetime-segment"
                >{{ segment.value }}</DatePickerInput
              >
            </div>
            <div class="app-datetime-time">
              <Clock3 :size="13" aria-hidden="true" />
              <DatePickerInput
                v-for="(segment, index) in splitSegments(segments).time"
                :key="index"
                :part="segment.part"
                class="app-datetime-segment"
                >{{ segment.value }}</DatePickerInput
              >
            </div>
          </div>
          <DatePickerTrigger class="app-datetime-trigger" :aria-label="`选择${label}的日期`"
            ><CalendarDays :size="18" aria-hidden="true"
          /></DatePickerTrigger>
        </DatePickerField>
      </DatePickerAnchor>
      <DatePickerContent
        class="app-datetime-popover"
        side="bottom"
        align="start"
        :side-offset="8"
        :collision-padding="16"
        :aria-label="`选择${label}`"
      >
        <DatePickerCalendar v-slot="{ weekDays, grid }">
          <DatePickerHeader class="app-datetime-calendar-header">
            <DatePickerPrev class="app-datetime-calendar-nav" aria-label="上个月"
              ><AppIcon name="chevron-left" :size="16" mode="static"
            /></DatePickerPrev>
            <DatePickerHeading class="app-datetime-calendar-heading" />
            <DatePickerNext class="app-datetime-calendar-nav" aria-label="下个月"
              ><AppIcon name="chevron-right" :size="16" mode="static"
            /></DatePickerNext>
          </DatePickerHeader>
          <DatePickerGrid
            v-for="month in grid"
            :key="month.value.toString()"
            class="app-datetime-calendar-grid"
          >
            <DatePickerGridHead>
              <DatePickerGridRow
                ><DatePickerHeadCell
                  v-for="day in weekDays"
                  :key="day"
                  class="app-datetime-weekday"
                  >{{ day }}</DatePickerHeadCell
                ></DatePickerGridRow
              >
            </DatePickerGridHead>
            <DatePickerGridBody>
              <DatePickerGridRow v-for="(week, index) in month.rows" :key="index">
                <DatePickerCell v-for="day in week" :key="day.toString()" :date="day">
                  <DatePickerCellTrigger :day="day" :month="month.value" class="app-datetime-day" />
                </DatePickerCell>
              </DatePickerGridRow>
            </DatePickerGridBody>
          </DatePickerGrid>
        </DatePickerCalendar>
        <p class="app-datetime-calendar-note">选择日期后，可在输入框中调整时间</p>
      </DatePickerContent>
    </DatePickerRoot>
  </div>
</template>

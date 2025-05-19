'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RRule, RRuleSet, rrulestr, Weekday, Frequency as RRuleFrequency } from 'rrule';
import { format, parseISO, isValid as isValidDate } from 'date-fns'; 

interface CustomRRuleGeneratorProps {
  value: string; 
  onChange: (newRRule: string) => void; 
  eventStartDate: string; 
}

type FrequencyOption = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type EndCondition = 'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES';

interface RRuleOptionsState {
  freq: FrequencyOption;
  interval: number;
  byweekday: number[]; 
  bymonthday: number | null;
  endCondition: EndCondition;
  until: string; 
  count: number | null;
}

const dayMap: { name: string, rruleConst: Weekday, value: number }[] = [
  { name: 'Mon', rruleConst: RRule.MO, value: 0 }, { name: 'Tue', rruleConst: RRule.TU, value: 1 },
  { name: 'Wed', rruleConst: RRule.WE, value: 2 }, { name: 'Thu', rruleConst: RRule.TH, value: 3 },
  { name: 'Fri', rruleConst: RRule.FR, value: 4 }, { name: 'Sat', rruleConst: RRule.SA, value: 5 },
  { name: 'Sun', rruleConst: RRule.SU, value: 6 },
];

const getValidDtStart = (eventStartDateString: string): Date => {
  let dtStart = new Date(); 
  if (eventStartDateString) {
    const parsedDate = parseISO(eventStartDateString); 
    if (isValidDate(parsedDate)) dtStart = parsedDate;
    else {
      const simpleParsedDate = new Date(eventStartDateString);
      if (isValidDate(simpleParsedDate)) dtStart = simpleParsedDate;
    }
  }
  return dtStart;
};

const rruleFreqMap: { [key: number]: FrequencyOption } = {
  [RRule.DAILY]: 'DAILY', [RRule.WEEKLY]: 'WEEKLY', [RRule.MONTHLY]: 'MONTHLY',
};

const calculateDefaultOptions = (dtStart: Date): RRuleOptionsState => {
    const isValidDt = dtStart && isValidDate(dtStart);
    return {
        freq: 'WEEKLY', 
        interval: 1,
        byweekday: isValidDt ? [dtStart.getDay() === 0 ? 6 : dtStart.getDay() -1] : [], 
        bymonthday: isValidDt ? dtStart.getDate() : null,
        endCondition: 'NEVER',
        until: '',
        count: null,
    };
};

const CustomRRuleGenerator: React.FC<CustomRRuleGeneratorProps> = ({
  value,
  onChange,
  eventStartDate,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  // Initialize recurrenceEnabled based on the initial presence of `value`
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(() => !!value); 

  const [options, setOptions] = useState<RRuleOptionsState>(() => calculateDefaultOptions(getValidDtStart(eventStartDate)));

  useEffect(() => {
    setIsMounted(true);
    // No need to setRecurrenceEnabled here based on value anymore, useState initializer handles it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Effect to parse RRULE value or set defaults based on eventStartDate and current value
  useEffect(() => {
    if (!isMounted) return;

    const currentDtStart = getValidDtStart(eventStartDate);

    if (value) { // If there's an RRULE string, try to parse it and update options
      try {
        const ruleInput = rrulestr(value, { unfold: true });
        let parsedRRuleOpts: RRule.Options | null = null;

        if (ruleInput instanceof RRule) parsedRRuleOpts = ruleInput.options;
        else if (ruleInput instanceof RRuleSet) {
          const rrules = ruleInput.rrules();
          if (rrules.length > 0) parsedRRuleOpts = rrules[0].options;
        }
        
        if (parsedRRuleOpts) {
          const freqOption = rruleFreqMap[parsedRRuleOpts.freq as RRuleFrequency] || 'WEEKLY';
          const currentUntil = parsedRRuleOpts.until ? new Date(parsedRRuleOpts.until) : null;
          const newOptionsState: RRuleOptionsState = {
            freq: freqOption,
            interval: parsedRRuleOpts.interval || 1,
            byweekday: parsedRRuleOpts.byweekday || [],
            bymonthday: parsedRRuleOpts.bymonthday && parsedRRuleOpts.bymonthday.length > 0 ? parsedRRuleOpts.bymonthday[0] : null,
            endCondition: parsedRRuleOpts.until ? 'ON_DATE' : parsedRRuleOpts.count ? 'AFTER_OCCURRENCES' : 'NEVER',
            until: currentUntil && isValidDate(currentUntil) ? format(currentUntil, 'yyyy-MM-dd') : '',
            count: parsedRRuleOpts.count || null,
          };
          if (JSON.stringify(newOptionsState) !== JSON.stringify(options)) {
             setOptions(newOptionsState);
          }
          // Ensure recurrence is enabled if we successfully parsed a value
          if (!recurrenceEnabled) setRecurrenceEnabled(true);

        } else { // rrulestr returned null (invalid string for parsing)
          const defaultOpts = calculateDefaultOptions(currentDtStart);
          if (JSON.stringify(options) !== JSON.stringify(defaultOpts)) setOptions(defaultOpts);
        }
      } catch (e) { 
        console.error("Error parsing RRULE string:", e, "Input value:", value);
        const defaultOpts = calculateDefaultOptions(currentDtStart);
        if (JSON.stringify(options) !== JSON.stringify(defaultOpts)) setOptions(defaultOpts);
      }
    } else { 
      // Value is empty: reset options to defaults based on current eventStartDate.
      // Also, ensure recurrence is marked as disabled.
      const defaultOpts = calculateDefaultOptions(currentDtStart);
      if (JSON.stringify(options) !== JSON.stringify(defaultOpts)) {
        setOptions(defaultOpts);
      }
      if (recurrenceEnabled) setRecurrenceEnabled(false); // Sync if value is empty
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, eventStartDate, isMounted]); // recurrenceEnabled removed as a direct dependency here to break loops
                                          // It's now managed based on `value` presence.

  // Construct RRULE string when options change OR recurrenceEnabled changes
  useEffect(() => {
    if (!isMounted) return;

    if (!recurrenceEnabled) { // If recurrence is explicitly disabled by user
      if (value !== "") onChange(""); // Clear the value in parent form
      return;
    }

    // If recurrence is enabled, proceed to generate rule
    const dtStart = getValidDtStart(eventStartDate);
    if (!isValidDate(dtStart)) {
      if (value !== "") onChange(""); 
      return;
    }
    
    // Conditions for an "empty" or invalid rule based on UI state
    if ((options.freq === 'WEEKLY' && options.byweekday.length === 0) ||
        (options.freq === 'MONTHLY' && !options.bymonthday) ||
        options.interval < 1) {
      if (value !== "") onChange(""); // If UI state implies no rule, clear existing value
      return; 
    }

    const rruleOptions: RRule.Options = {
      freq: RRule[options.freq] as RRuleFrequency,
      interval: options.interval,
      dtstart: dtStart, byweekday: null, bymonthday: null, until: null, count: null,
      bymonth: null, bysetpos: null, byyearday: null, byweekno: null, 
      byhour: null, byminute: null, bysecond: null, wkst: RRule.SU, 
    };

    if (options.freq === 'WEEKLY') rruleOptions.byweekday = options.byweekday; 
    if (options.freq === 'MONTHLY') rruleOptions.bymonthday = options.bymonthday;

    if (options.endCondition === 'ON_DATE' && options.until) {
      const untilDate = parseISO(options.until + "T23:59:59Z"); 
      if (isValidDate(untilDate)) rruleOptions.until = untilDate;
    } else if (options.endCondition === 'AFTER_OCCURRENCES' && options.count && options.count > 0) {
      rruleOptions.count = options.count;
    }
    
    try {
      const rule = new RRule(rruleOptions);
      const newRuleString = rule.toString();
      if (newRuleString !== value) onChange(newRuleString);
    } catch (e) {
      console.error("Error generating RRULE string:", e, "Options:", rruleOptions);
      if (value !== "") onChange(""); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, eventStartDate, recurrenceEnabled, isMounted]); // `value` and `onChange` are not direct deps here

  const handleToggleRecurrence = () => {
    const newEnabledState = !recurrenceEnabled;
    setRecurrenceEnabled(newEnabledState);
    // If disabling, the generation useEffect will call onChange("").
    // If enabling, the parsing/defaulting useEffect (triggered by recurrenceEnabled change if value is empty)
    // or the generation useEffect (if options are already valid) should handle producing a rule.
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFreq = e.target.value as FrequencyOption;
    const dtStart = getValidDtStart(eventStartDate); 
    setOptions(() => { // No prevOpts needed, always reset for new frequency
      const freshDefaults = calculateDefaultOptions(dtStart);
      return {
        ...freshDefaults, 
        freq: newFreq,
        byweekday: newFreq === 'WEEKLY' ? freshDefaults.byweekday : [],
        bymonthday: newFreq === 'MONTHLY' ? freshDefaults.bymonthday : null,
        interval: 1, 
        endCondition: 'NEVER',
        until: '',
        count: null,
      };
    });
  };
  
  // ... other handlers (handleIntervalChange, handleWeekdayToggle, etc.) remain the same
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInterval = parseInt(e.target.value, 10);
    setOptions(prev => ({ ...prev, interval: newInterval >= 1 ? newInterval : 1 }));
  };

  const handleWeekdayToggle = (dayValue: number) => {
    setOptions(prev => {
      const newByWeekday = prev.byweekday.includes(dayValue)
        ? prev.byweekday.filter(d => d !== dayValue) 
        : [...prev.byweekday, dayValue];
      return { ...prev, byweekday: newByWeekday.sort((a,b) => a-b) };
    });
  };

  const handleMonthDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let dayVal = e.target.value;
    if (dayVal === "") { setOptions(prev => ({ ...prev, bymonthday: null })); return; }
    let day = parseInt(dayVal, 10);
    if (isNaN(day)) { setOptions(prev => ({ ...prev, bymonthday: null })); return; }
    if (day < 1) day = 1; if (day > 31) day = 31; 
    setOptions(prev => ({ ...prev, bymonthday: day }));
  };

  const handleEndConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOptions(prev => ({ ...prev, endCondition: e.target.value as EndCondition, until: '', count: null }));
  };

  const handleUntilDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, until: e.target.value }));
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = parseInt(e.target.value, 10);
    setOptions(prev => ({ ...prev, count: newCount > 0 ? newCount : null }));
  };
  
  const inputBaseClass = "mt-1 block w-full px-3 py-2 h-9 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50";
  const labelBaseClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  const smallInputClass = `${inputBaseClass} w-20 text-center`;

  if (!isMounted) return null;

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 shadow">
      <div className="flex items-center mb-4">
        <input
          type="checkbox"
          id="recurrenceEnabled"
          checked={recurrenceEnabled}
          onChange={handleToggleRecurrence}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-indigo-600 dark:ring-offset-gray-800"
        />
        <label htmlFor="recurrenceEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Enable Recurrence
        </label>
      </div>

      {recurrenceEnabled && (
        <div className="space-y-4">
          <div className="flex items-end space-x-3">
            <div>
              <label htmlFor="freq" className={labelBaseClass}>Repeats</label>
              <select id="freq" value={options.freq} onChange={handleFrequencyChange} className={inputBaseClass}>
                <option value="DAILY">Daily</option> <option value="WEEKLY">Weekly</option> <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="interval" className={labelBaseClass}>Every</label>
              <input type="number" id="interval" value={options.interval} onChange={handleIntervalChange} min="1" className={smallInputClass}/>
            </div>
            <span className="pb-2 text-sm text-gray-700 dark:text-gray-300">
              {options.freq === 'DAILY' ? 'day(s)' : options.freq === 'WEEKLY' ? 'week(s)' : 'month(s)'}
            </span>
          </div>

          {options.freq === 'WEEKLY' && (
            <div>
              <label className={labelBaseClass}>On</label>
              <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dayMap.map(day => (
                  <button type="button" key={day.value} onClick={() => handleWeekdayToggle(day.value)}
                    className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${options.byweekday.includes(day.value)
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                    {day.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.freq === 'MONTHLY' && (
            <div>
              <label htmlFor="bymonthday" className={labelBaseClass}>On day</label>
              <input type="number" id="bymonthday" value={options.bymonthday || ''} onChange={handleMonthDayChange} min="1" max="31" className={smallInputClass} placeholder="e.g. 15"/>
            </div>
          )}

          <div>
            <label htmlFor="endCondition" className={labelBaseClass}>Ends</label>
            <div className="flex items-center space-x-3 mt-1">
                <select id="endCondition" value={options.endCondition} onChange={handleEndConditionChange} className={`${inputBaseClass} w-auto`}>
                    <option value="NEVER">Never</option> <option value="ON_DATE">On date</option> <option value="AFTER_OCCURRENCES">After</option>
                </select>
                {options.endCondition === 'ON_DATE' && (
                    <input type="date" id="until" value={options.until} onChange={handleUntilDateChange} className={`${inputBaseClass} w-auto`}/>
                )}
                {options.endCondition === 'AFTER_OCCURRENCES' && (
                    <div className="flex items-center space-x-2">
                        <input type="number" id="count" value={options.count || ''} onChange={handleCountChange} min="1" className={smallInputClass} placeholder="e.g. 10"/>
                        <span className="text-sm text-gray-700 dark:text-gray-300">occurrences</span>
                    </div>
                )}
            </div>
          </div>
          <button type="button"
            onClick={() => { 
                const dtStart = getValidDtStart(eventStartDate);
                setOptions(calculateDefaultOptions(dtStart)); 
            }}
            className="mt-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            Reset Recurrence Options
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomRRuleGenerator;

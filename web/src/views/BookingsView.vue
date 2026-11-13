<template>
  <div class="page-card">
    <!-- 筛选区：桌面工具栏保持原样；<768px 用下方移动工具栏（关键词+查询+筛选开关，展开显示其余筛选） -->
    <el-card shadow="never">
      <div class="page-toolbar desktop-toolbar">
        <el-select
          v-model="filters.customer_id"
          placeholder="客户"
          clearable
          filterable
          style="width: 160px"
        >
          <el-option
            v-for="c in customerOptions"
            :key="c.id"
            :label="c.name"
            :value="c.id"
          />
        </el-select>
        <el-select
          v-model="filters.hotel_id"
          placeholder="酒店"
          clearable
          filterable
          style="width: 180px"
        >
          <el-option
            v-for="h in hotelOptions"
            :key="h.id"
            :label="h.name"
            :value="h.id"
          />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 130px">
          <el-option v-for="(m, k) in STATUS_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-date-picker
          v-model="filterRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="入住起"
          end-placeholder="入住止"
          :editable="false"
          style="width: 240px"
        />
        <el-input
          v-model="filters.search"
          placeholder="客户名 / 酒店名关键词"
          clearable
          style="width: 200px"
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <el-button :icon="Download" @click="exportCsv">导出</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建预定</el-button>
      </div>

      <!-- 移动端工具栏：一行（关键词+查询+筛选开关），展开显示其余筛选与操作 -->
      <div class="mobile-toolbar">
        <el-input
          v-model="filters.search"
          class="toolbar-search"
          placeholder="客户名 / 酒店名关键词"
          clearable
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? '收起筛选' : '筛选' }}
        </el-button>
        <el-button type="primary" :icon="Plus" circle title="新建预定" @click="openCreate" />
        <el-button :icon="Download" circle title="导出" @click="exportCsv" />
        <div v-show="filtersExpanded" class="filter-extra">
          <el-select v-model="filters.customer_id" placeholder="客户" clearable filterable>
            <el-option v-for="c in customerOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="filters.hotel_id" placeholder="酒店" clearable filterable>
            <el-option v-for="h in hotelOptions" :key="h.id" :label="h.name" :value="h.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="状态" clearable>
            <el-option v-for="(m, k) in STATUS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <div class="filter-date-range">
            <el-date-picker
              v-model="filterStart"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="入住起"
              :editable="false"
              :disabled-date="(d) => filterEnd && d > parseLocalDate(filterEnd)"
              @change="onFilterStartChange"
            />
            <span class="range-sep">至</span>
            <el-date-picker
              v-model="filterEnd"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="入住止"
              :editable="false"
              :disabled-date="(d) => filterStart && d < parseLocalDate(filterStart)"
            />
          </div>
          <el-button @click="resetFilters">重置</el-button>
          
        </div>
      </div>

      <!-- 列表：桌面表格 / 移动卡片（同一份 rows 数据，CSS 切换） -->
      <div class="desktop-table">
        <el-table :data="rows" v-loading="loading" empty-text="暂无预定数据" :default-sort="{ prop: 'order_time', order: 'descending' }" @sort-change="onSortChange">
        <el-table-column prop="order_time" label="下单时间" width="165" sortable="custom">
          <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="90" />
        <el-table-column prop="hotel_name" label="酒店" min-width="130" />
        <el-table-column label="预订人" width="90">
          <template #default="{ row }">{{ row.benefit_holder_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="check_in" label="入住/离店" min-width="175" sortable="custom">
          <template #default="{ row }">{{ dateText(row.check_in) }} ~ {{ dateText(row.check_out) }}</template>
        </el-table-column>
        <el-table-column prop="nights" label="晚数" width="65" align="center" />
        <el-table-column prop="room_count" label="间数" width="65" align="center" />
        <el-table-column prop="items_summary" label="明细" min-width="140" show-overflow-tooltip />
        <el-table-column prop="sale_total" label="卖价" width="105" align="right" sortable="custom">
          <template #default="{ row }"><span class="money money-revenue">{{ money(row.sale_total) }}</span></template>
        </el-table-column>
        <el-table-column label="成本" width="105" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.cost_total) }}</span></template>
        </el-table-column>
        <el-table-column label="手续费" width="90" align="right">
          <template #default="{ row }"><span class="money money-fee">{{ money(row.fee) }}</span></template>
        </el-table-column>
        <el-table-column prop="profit" label="净利" width="95" align="right" sortable="custom">
          <template #default="{ row }">
            <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="渠道" width="70" align="center">
          <template #default="{ row }">{{ channelText(row.channel) }}</template>
        </el-table-column>
        <el-table-column label="双早" width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.breakfast_included" type="success" size="small">双早</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="权益" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.benefit_used" type="warning" size="small">
              已用{{ row.benefit_count_used > 1 ? `×${row.benefit_count_used}` : '' }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="已结算" width="75" align="center">
          <template #default="{ row }">
            <template v-if="row.benefit_holder_id">
              <el-tag
                :type="row.holder_settled ? 'success' : 'info'"
                size="small"
                class="settle-toggle"
                @click="toggleSettled(row)"
              >
                {{ row.holder_settled ? '已结算' : '未结算' }}
              </el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <!-- V7 内联改状态：点徽标展开全部状态，选中即保存（权益流转由后端 PUT 处理） -->
            <el-dropdown trigger="click" @command="(s) => onInlineStatusChange(row, s)">
              <el-tag :type="statusMeta(row.status).type" :class="statusMeta(row.status).cls" size="small" class="status-toggle">
                {{ statusMeta(row.status).label }}<el-icon class="status-caret"><ArrowDown /></el-icon>
              </el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="(m, k) in STATUS_MAP"
                    :key="k"
                    :command="k"
                    :disabled="k === row.status"
                  >{{ m.label }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="primary" @click="openCopy(row)">复制</el-button>
            <el-button text type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表（.mobile-cards：<768px 显示） -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!rows.length" description="暂无预定数据" :image-size="60" />
        <div v-for="row in rows" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.customer_name }}</span>
            <el-tag :type="statusMeta(row.status).type" :class="statusMeta(row.status).cls" size="small">
              {{ statusMeta(row.status).label }}
            </el-tag>
          </div>
          <div class="m-sub">{{ row.hotel_name }}</div>
          <div class="m-line">
            <span class="m-label">入住/离店</span>
            <span class="m-value">{{ dateText(row.check_in) }} ~ {{ dateText(row.check_out) }}（{{ row.nights }}晚/{{ row.room_count }}间）</span>
          </div>
          <div class="m-line">
            <span class="m-label">明细</span>
            <span class="m-value">{{ row.items_summary || '-' }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">卖价/成本</span>
            <span class="m-value">
              <span class="money money-revenue">{{ money(row.sale_total) }}</span>
              /
              <span class="money">{{ money(row.cost_total) }}</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">手续费/净利</span>
            <span class="m-value">
              <span class="money money-fee">{{ money(row.fee) }}</span>
              /
              <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">权益</span>
            <span class="m-value">
              <template v-if="row.benefit_used">
                已用{{ row.benefit_count_used > 1 ? `×${row.benefit_count_used}` : '' }}{{ row.benefit_holder_name ? `（${row.benefit_holder_name}）` : '' }}
              </template>
              <template v-else>-</template>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">下单时间</span>
            <span class="m-value">{{ datetimeText(row.order_time) }}</span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="primary" size="small" @click="openCopy(row)">复制</el-button>
            <el-button text type="danger" size="small" @click="onDelete(row)">删除</el-button>
            <!-- 移动端改状态：ActionSheet 式下拉 -->
            <el-dropdown trigger="click" class="m-status-dd" @command="(s) => onInlineStatusChange(row, s)">
              <el-button text type="primary" size="small">改状态</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="(m, k) in STATUS_MAP"
                    :key="k"
                    :command="k"
                    :disabled="k === row.status"
                  >{{ m.label }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next, sizes"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </el-card>

    <!-- 新建/编辑/复制抽屉 -->
    <el-drawer
      v-model="formVisible"
      :title="drawerTitle"
      size="640px"
      destroy-on-close
    >
      <div class="drawer-hint">一笔预定可包含多种房型（每行选一种）；每晚价 × 晚数自动汇总</div>
      <el-alert
        v-if="hotelNeedsPresence"
        title="该酒店需预订人本人到场办理"
        type="warning"
        show-icon
        :closable="false"
        class="presence-alert"
      />
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px">
        <el-form-item label="客户" prop="customer_id">
          <el-select
            v-model="form.customer_id"
            placeholder="选择客户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="c in customerOptions"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="酒店" prop="hotel_id">
          <el-select
            v-model="form.hotel_id"
            placeholder="选择酒店"
            filterable
            style="width: 100%"
            @change="onHotelChange"
          >
            <el-option
              v-for="h in hotelOptions"
              :key="h.id"
              :label="h.name"
              :value="h.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预订人">
          <el-select
            v-model="form.benefit_holder_id"
            placeholder="选择预订人（可空）"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="h in sortedHolderOptions"
              :key="h.id"
              :value="h.id"
              :label="holderLabel(h)"
            >
              <div class="holder-option">
                <span>{{ holderLabel(h) }}</span>
                <span class="holder-meta">
                  <el-tag v-if="h.provides_hotel" type="success" size="small">出酒店</el-tag>
                  <el-tag v-if="h.willing_present" type="success" size="small">✓愿意到场</el-tag>
                </span>
              </div>
            </el-option>
          </el-select>
          <div v-if="hotelNeedsPresence" class="field-tip">该酒店需本人到场，优先选择带「✓愿意到场」的预订人</div>
        </el-form-item>
        <el-form-item label="入住/离店" prop="dateRange">
          <el-date-picker
            v-model="formRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="入住日期"
            end-placeholder="离店日期"
            :editable="false"
            class="desktop-only"
            style="width: 100%"
          />
          <div class="mobile-only">
            <div class="mobile-date-range">
              <el-date-picker
                v-model="formCheckIn"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="入住日期"
                :editable="false"
                @change="onCheckInChange"
              />
              <el-date-picker
                v-model="formCheckOut"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="离店日期"
                :editable="false"
                :disabled-date="(d) => formCheckIn && d < parseLocalDate(formCheckIn)"
              />
            </div>
          </div>
          <span v-if="formNights > 0" class="nights-tip">共 {{ formNights }} 晚</span>
        </el-form-item>

        <el-form-item
          v-for="(item, index) in form.items"
          :key="index"
          :label="index === 0 ? '房间明细' : ''"
          :prop="'items.' + index + '.price'"
          :rules="itemPriceRules"
        >
          <div class="item-row">
            <div class="item-line">
              <el-select
                v-model="item.room_type_id"
                placeholder="选择房型"
                filterable
                class="item-room"
                @change="onItemRoomChange(item)"
              >
                <el-option
                  v-for="rt in roomTypeOptions"
                  :key="rt.id"
                  :label="rt.name"
                  :value="rt.id"
                />
              </el-select>
              <el-button
                v-if="form.items.length > 1"
                :icon="Delete"
                circle
                type="danger"
                plain
                @click="removeItem(index)"
              />
            </div>
            <div class="item-line">
              <span class="item-price-label">每晚价</span>
              <el-input-number
                v-model="item.price"
                :min="0"
                :precision="2"
                :step="50"
                :controls="false"
                placeholder="每晚价"
                class="item-price"
              />
              <span class="item-subtotal">× {{ formNights }}晚 = <b class="money">{{ money(itemSubtotal(item)) }}</b></span>
            </div>
            <div v-if="itemRates(item).length" class="rate-chips">
              <el-tag
                v-for="r in itemRates(item)"
                :key="r.id"
                class="rate-chip"
                size="small"
                effect="plain"
                @click="applyRate(item, r)"
              >
                {{ r.label }} ¥{{ Number(r.price).toFixed(0) }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button :icon="Plus" plain type="primary" @click="addItem">加一间</el-button>
          <span class="sale-summary">卖价合计（每晚价×晚数）：<b class="money money-revenue">{{ money(formSaleTotal) }}</b></span>
        </el-form-item>

        <el-form-item label="成本合计" prop="cost_total">
          <el-input-number
            v-model="form.cost_total"
            :min="0"
            :precision="2"
            :step="50"
            :controls="false"
            placeholder="本单成本"
            style="width: 100%"
          />
        </el-form-item>

        <!-- V7 手续费率：默认 渠道=闲鱼→1.6% 其他→0；切渠道时未手动改过则跟随默认 -->
        <el-form-item label="手续费率">
          <el-input-number
            v-model="form.fee_rate_pct"
            :min="0"
            :max="50"
            :precision="1"
            :step="0.1"
            :controls="false"
            placeholder="0-50"
            style="width: 120px"
            @change="onFeeRateManualChange"
          />
          <span class="fee-unit">%</span>
          <span class="nights-tip">
            手续费：<b class="money">{{ money(formFeeAmount) }}</b>（卖价 × 费率）
          </span>
          <div class="field-tip">预计净利：{{ profitText(formNetProfit) }}（卖价 − 成本 − 手续费）</div>
        </el-form-item>

        <el-form-item label="升级权益">
          <div class="benefit-block">
            <div class="benefit-line">
              <el-checkbox v-model="form.benefit_used">使用升级权益</el-checkbox>
              <el-input-number
                v-if="form.benefit_used"
                v-model="form.benefit_count_used"
                :min="1"
                :max="99"
                :step="1"
                :controls="false"
                style="width: 100px"
              />
              <el-text v-if="form.benefit_used" type="info" size="small">张</el-text>
            </div>
            <div v-if="form.benefit_used" class="field-tip">
              <template v-if="formHolder">
                {{ formHolder.name }} 酒店权益 剩余 {{ formHolder.hotel_benefit_count }} 次
              </template>
              <template v-else>使用升级权益需选择预订人</template>
            </div>
            <el-text v-if="form.benefit_used && formHolder && formHolder.hotel_benefit_count <= 0" type="danger" size="small">
              剩余不足，勾选后保存将被拒绝
            </el-text>
          </div>
        </el-form-item>

        <el-form-item label="结算">
          <el-switch v-model="form.holder_settled" active-text="已给权益人结算" />
          <div v-if="settleHint" class="field-tip">{{ settleHint }}</div>
        </el-form-item>

        <el-form-item label="成交渠道">
          <el-select v-model="form.channel" style="width: 140px" @change="onChannelChange">
            <el-option v-for="(m, k) in CHANNEL_MAP" :key="k" :label="m" :value="k" />
          </el-select>
          <div class="field-tip">闲鱼渠道手续费率默认 1.6%，其他渠道默认 0%</div>
        </el-form-item>
        <el-form-item label="含双早">
          <el-switch v-model="form.breakfast_included" active-text="含双早" />
        </el-form-item>
        <el-form-item label="下单时间" prop="order_time">
          <el-date-picker
            v-model="form.order_time"
            type="datetime"
            placeholder="选择下单时间"
            :editable="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="(m, k) in STATUS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <div class="field-tip">按流程推进：沟通中 → … → 入住完成；任意阶段可转已取消（权益返还）</div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">
          {{ formMode === 'copy' ? '保存为新预定' : '保存' }}
        </el-button>
      </template>
    </el-drawer>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="预定详情" size="560px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="下单时间" :span="2">{{ datetimeText(detail.order_time) }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="酒店">{{ detail.hotel_name }}</el-descriptions-item>
        <el-descriptions-item label="预订人">
          <template v-if="detail.benefit_holder_name">
            {{ detail.benefit_holder_name }}
            <el-tag v-if="detailHolder && detailHolder.willing_present" type="success" size="small">✓ 愿意到场</el-tag>
            <el-tag v-if="detailHolder && detailHolder.willing_assist" type="success" size="small">✓ 愿意协助</el-tag>
          </template>
          <template v-else>-</template>
        </el-descriptions-item>
        <el-descriptions-item label="入住日期">{{ dateText(detail.check_in) }}</el-descriptions-item>
        <el-descriptions-item label="离店日期">{{ dateText(detail.check_out) }}</el-descriptions-item>
        <el-descriptions-item label="晚数">{{ detail.nights }}</el-descriptions-item>
        <el-descriptions-item label="间数">{{ detail.room_count }}</el-descriptions-item>
        <el-descriptions-item label="卖价合计">
          <span class="money money-revenue">{{ money(detail.sale_total) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="成本合计">
          <span class="money">{{ money(detail.cost_total) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="手续费">
          <span class="money money-fee">{{ money(detail.fee) }}</span>
          <span class="flow-step">（费率 {{ feeRatePctText(detail.fee_rate) }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="净利">
          <span class="money" :class="profitClass(detail.profit)">{{ profitText(detail.profit) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="成交渠道">{{ channelText(detail.channel) }}</el-descriptions-item>
        <el-descriptions-item label="含双早">{{ detail.breakfast_included ? '含双早' : '不含' }}</el-descriptions-item>
        <el-descriptions-item label="酒店权益">
          {{ detail.benefit_used ? `已使用×${detail.benefit_count_used || 1}` : '未使用' }}
        </el-descriptions-item>
        <el-descriptions-item label="已结算">
          <template v-if="detail.benefit_holder_id">{{ detail.holder_settled ? '已给权益人结算' : '未结算' }}</template>
          <template v-else>-</template>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusMeta(detail.status).type" :class="statusMeta(detail.status).cls" size="small">
            {{ statusMeta(detail.status).label }}
          </el-tag>
          <span class="flow-step">{{ flowPositionText }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.notes || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h4 class="detail-items-title">每晚价明细</h4>
      <el-table :data="detail.items || []" empty-text="无明细" size="small">
        <el-table-column label="#" type="index" width="45" />
        <el-table-column prop="room_type_name" label="房型" min-width="110" />
        <el-table-column label="每晚价" align="right" width="90">
          <template #default="{ row }"><span class="money">{{ money(row.price) }}</span></template>
        </el-table-column>
        <el-table-column :label="`小计（×${detail.nights || 0}晚）`" align="right" min-width="120">
          <template #default="{ row }">
            <span class="money">{{ money(Number(row.price || 0) * (detail.nights || 0)) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {  Plus, Delete, ArrowDown , Download } from '@element-plus/icons-vue'
import { bookingsApi, customersApi, hotelsApi, roomTypesApi, benefitHoldersApi, exportApi } from '../api'
import {
  money, profitText, profitClass, revenueClass, dateText, datetimeText,
  toDatetimeString, parseDatetime, statusMeta, STATUS_MAP, statusStep,
  channelText, CHANNEL_MAP, feeRatePctText, defaultFeeRatePct,
} from '../utils/format'

// ===== 下拉选项 =====
const customerOptions = ref([])
const hotelOptions = ref([])
const roomTypeOptions = ref([])
const holderOptions = ref([])

async function loadOptions() {
  try {
    const [cs, hs, bh] = await Promise.all([
      customersApi.list({ page: 1, page_size: 100 }),
      hotelsApi.list({ page: 1, page_size: 100 }),
      benefitHoldersApi.list({ page: 1, page_size: 200 }),
    ])
    customerOptions.value = cs.items || []
    hotelOptions.value = hs.items || []
    // provides_hotel/provides_golf 兜底为 1（老数据/异常响应时按「都出」处理）
    holderOptions.value = (bh.items || []).map((h) => ({
      ...h,
      provides_hotel: h.provides_hotel ?? 1,
      provides_golf: h.provides_golf ?? 1,
    }))
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

// 预订人选项：姓名（权益摘要）；willing_present=1 标注并排前
const sortedHolderOptions = computed(() =>
  [...holderOptions.value].sort((a, b) => (b.willing_present ? 1 : 0) - (a.willing_present ? 1 : 0)),
)

function holderLabel(h) {
  return `${h.name}（${h.benefit_types || '未登记权益'}）`
}

// 所选酒店入住政策联动：需本人到场时抽屉顶部橙色提示
const selectedHotel = computed(() =>
  hotelOptions.value.find((h) => h.id === form.hotel_id) || null,
)

const hotelNeedsPresence = computed(() => selectedHotel.value?.checkin_presence === 1)

const detailHolder = computed(() =>
  holderOptions.value.find((h) => h.id === detail.value.benefit_holder_id) || null,
)

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
// 移动端筛选折叠开关（桌面端由 CSS display:contents 还原平铺，不受影响）
const filtersExpanded = ref(false)

const filters = reactive({
  customer_id: null,
  hotel_id: null,
  status: null,
  dateRange: ['', ''],
  search: '',
  sort_by: null,
  sort_order: null,
})

// 日期工具：value-format 为 YYYY-MM-DD 时用本地时区解析，避免 new Date('YYYY-MM-DD') 按 UTC 解析导致禁选偏差
function parseLocalDate(str) {
  if (!str) return null
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDaysStr(str, days) {
  const d = parseLocalDate(str)
  if (!d) return ''
  d.setDate(d.getDate() + days)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 筛选日期：桌面 daterange 与移动端两个独立 date 输入共用 filters.dateRange，且始终为数组（清空时归一为 ['','']）
const filterRange = computed({
  get: () => filters.dateRange,
  set: (v) => {
    filters.dateRange = Array.isArray(v) && v.length === 2 ? v : ['', '']
  },
})

const filterStart = computed({
  get: () => (Array.isArray(filters.dateRange) ? filters.dateRange[0] : '') || '',
  set: (v) => {
    if (!Array.isArray(filters.dateRange)) filters.dateRange = ['', '']
    filters.dateRange[0] = v || ''
  },
})

const filterEnd = computed({
  get: () => (Array.isArray(filters.dateRange) ? filters.dateRange[1] : '') || '',
  set: (v) => {
    if (!Array.isArray(filters.dateRange)) filters.dateRange = ['', '']
    filters.dateRange[1] = v || ''
  },
})

// 移动端筛选「起」晚于「止」时自动同步「止」=「起」（单日也允许相等）
function onFilterStartChange() {
  if (filterStart.value && filterEnd.value && filterStart.value > filterEnd.value) {
    filterEnd.value = filterStart.value
  }
}

async function exportCsv() {
  const params = {
    customer_id: filters.customer_id || undefined,
    hotel_id: filters.hotel_id || undefined,
    status: filters.status || undefined,
    date_from: filters.dateRange?.[0] || undefined,
    date_to: filters.dateRange?.[1] || undefined,
    search: filters.search || undefined,
  }
  await exportApi.bookings(params)
}

// 列排序：服务端排序（保证全量数据一致），仅支持可排序列
function onSortChange({ prop, order }) {
  filters.sort_by = order ? prop : null
  filters.sort_order = order === 'ascending' ? 'asc' : 'desc'
  loadList(1)
}

async function loadList(p = page.value) {
  loading.value = true
  try {
    const params = {
      page: p,
      page_size: pageSize.value,
      customer_id: filters.customer_id || undefined,
      hotel_id: filters.hotel_id || undefined,
      status: filters.status || undefined,
      date_from: filters.dateRange?.[0] || undefined,
      date_to: filters.dateRange?.[1] || undefined,
      search: filters.search || undefined,
      sort_by: filters.sort_by || undefined,
      sort_order: filters.sort_order || undefined,
    }
    const data = await bookingsApi.list(params)
    rows.value = data.items || []
    total.value = data.total || 0
    page.value = p
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.customer_id = null
  filters.hotel_id = null
  filters.status = null
  filters.dateRange = ['', '']
  filters.search = ''
  loadList(1)
}

function onPageChange(p) {
  loadList(p)
}

function onSizeChange(size) {
  pageSize.value = size
  loadList(1)
}

// ===== 新建/编辑/复制表单 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)
// create / edit / copy：copy 预填客户/酒店/日期/明细/成本/双早/渠道，清空权益人与结算
const formMode = ref('create')

const drawerTitle = computed(() => {
  if (formMode.value === 'edit') return '编辑预定'
  if (formMode.value === 'copy') return '复制预定（可换预订人拆单）'
  return '新建预定'
})

function todayStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const emptyForm = () => ({
  id: null,
  customer_id: null,
  hotel_id: null,
  benefit_holder_id: null,
  dateRange: [todayStr(0), todayStr(1)],
  items: [{ room_type_id: null, price: null }],
  cost_total: null,
  benefit_used: false,
  benefit_count_used: 1,
  holder_settled: false,
  breakfast_included: false,
  channel: 'xianyu',
  fee_rate_pct: defaultFeeRatePct('xianyu'), // V7：百分比展示值（1.6 = 1.6%）
  order_time: new Date(),
  status: 'communicating',
  notes: '',
})

const form = reactive(emptyForm())

// 日期范围统一为数组（清空时归一为 ['','']），避免移动端 form.dateRange[0]/[1] 直接绑定在清空后报 null 索引错误
const formRange = computed({
  get: () => form.dateRange,
  set: (v) => {
    form.dateRange = Array.isArray(v) && v.length === 2 ? v : ['', '']
  },
})

function ensureFormRange() {
  if (!Array.isArray(form.dateRange)) form.dateRange = ['', '']
}

const formCheckIn = computed({
  get: () => (Array.isArray(form.dateRange) ? form.dateRange[0] : '') || '',
  set: (v) => {
    ensureFormRange()
    form.dateRange[0] = v || ''
  },
})

const formCheckOut = computed({
  get: () => (Array.isArray(form.dateRange) ? form.dateRange[1] : '') || '',
  set: (v) => {
    ensureFormRange()
    form.dateRange[1] = v || ''
  },
})

// V7 手续费率默认逻辑：切换渠道时若用户未手动改过，则跟随默认（闲鱼 1.6 / 其他 0）
const feeRateTouched = ref(false)

function onFeeRateManualChange() {
  feeRateTouched.value = true
}

function onChannelChange() {
  if (!feeRateTouched.value) {
    form.fee_rate_pct = defaultFeeRatePct(form.channel)
  }
}

// 手续费金额（表单实时估算）与预计净利
const formFeeAmount = computed(() =>
  Math.round(formSaleTotal.value * (Number(form.fee_rate_pct || 0) / 100) * 100) / 100,
)
const formNetProfit = computed(() =>
  formSaleTotal.value - Number(form.cost_total || 0) - formFeeAmount.value,
)

// fee_rate 载荷值：百分比 → 小数（0~0.5）
function feeRatePayload() {
  const pct = Number(form.fee_rate_pct || 0)
  return Math.round(Math.min(Math.max(pct, 0), 50) * 100) / 10000
}

const formRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  hotel_id: [{ required: true, message: '请选择酒店', trigger: 'change' }],
  dateRange: [{ required: true, message: '请选择入住/离店日期', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

const itemPriceRules = [
  { required: true, message: '请填写每晚价', trigger: 'blur' },
  { type: 'number', min: 0, message: '每晚价不能为负', trigger: 'blur' },
]

// 所选预订人（酒店权益剩余次数随切换刷新）
const formHolder = computed(() =>
  holderOptions.value.find((h) => h.id === form.benefit_holder_id) || null,
)

// 结算时机提示（V3.2 §2）：按所选预订人 source_channel 联动，灰字不强制
const settleHint = computed(() => {
  if (!formHolder.value) return ''
  if (formHolder.value.source_channel === 'xianyu') return '闲鱼渠道：客户入住完成后去闲鱼确认收货'
  if (formHolder.value.source_channel === 'wechat') return '微信好友：酒店订单确认后微信转账'
  return ''
})

const formNights = computed(() => {
  const [a, b] = form.dateRange || []
  if (!a || !b) return 0
  const diff = new Date(b) - new Date(a)
  return Math.round(diff / 86400000)
})

// 移动端入住日期变更：晚于离店时自动同步离店 = 入住 + 1 天
function onCheckInChange() {
  const checkIn = formCheckIn.value
  const checkOut = formCheckOut.value
  if (!checkIn) return
  if (!checkOut || checkOut <= checkIn) {
    formCheckOut.value = addDaysStr(checkIn, 1)
  }
}

// V5 每晚价模型：行小计 = 每晚价 × 晚数；卖价合计 = Σ行小计（与后端 nights×Σ(price) 一致）
function itemSubtotal(it) {
  return (Number(it.price) || 0) * formNights.value
}

const formSaleTotal = computed(() =>
  form.items.reduce((sum, it) => sum + itemSubtotal(it), 0),
)

// 该明细行所选房型的价格档位（chips 数据源）
function itemRates(it) {
  const rt = roomTypeOptions.value.find((r) => r.id === it.room_type_id)
  return rt?.rates || []
}

// 选房型后自动填入该房型参考价（default_price）；已有值不覆盖，仅空时填充
function onItemRoomChange(it) {
  const rt = roomTypeOptions.value.find((r) => r.id === it.room_type_id)
  if (rt && rt.default_price != null && (it.price == null || it.price === '')) {
    it.price = Number(rt.default_price)
  }
}

// 点档位 chip：将该行每晚价设为档位价
function applyRate(it, rate) {
  it.price = Number(rate.price)
}

function openCreate() {
  Object.assign(form, emptyForm())
  feeRateTouched.value = false
  formMode.value = 'create'
  roomTypeOptions.value = []
  formVisible.value = true
}

// 详情 → 全量 PUT 载荷（后端 PUT 需提交所有字段；fee_rate 不传会被后端按渠道默认重置，故必须带上）
function payloadFromDetail(d, override = {}) {
  return {
    customer_id: d.customer_id,
    hotel_id: d.hotel_id,
    benefit_holder_id: d.benefit_holder_id ?? null,
    check_in: dateText(d.check_in),
    check_out: dateText(d.check_out),
    cost_total: Number(d.cost_total || 0),
    benefit_used: d.benefit_used ? 1 : 0,
    benefit_count_used: Number(d.benefit_count_used || 1),
    order_time: d.order_time ? toDatetimeString(d.order_time) : '',
    status: d.status,
    channel: d.channel || 'xianyu',
    fee_rate: Number(d.fee_rate || 0),
    breakfast_included: d.breakfast_included ? 1 : 0,
    holder_settled: d.holder_settled ? 1 : 0,
    notes: d.notes || '',
    items: (d.items || []).map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
    ...override,
  }
}

async function openEdit(row) {
  try {
    const d = await bookingsApi.detail(row.id)
    Object.assign(form, emptyForm(), {
      id: d.id,
      customer_id: d.customer_id,
      hotel_id: d.hotel_id,
      benefit_holder_id: d.benefit_holder_id || null,
      dateRange: [dateText(d.check_in), dateText(d.check_out)],
      items: (d.items || []).map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
      cost_total: Number(d.cost_total),
      benefit_used: !!d.benefit_used,
      benefit_count_used: Number(d.benefit_count_used || 1),
      holder_settled: !!d.holder_settled,
      breakfast_included: !!d.breakfast_included,
      channel: d.channel || 'xianyu',
      fee_rate_pct: Math.round(Number(d.fee_rate || 0) * 10000) / 100,
      order_time: parseDatetime(d.order_time),
      status: d.status,
      notes: d.notes || '',
    })
    feeRateTouched.value = false
    formMode.value = 'edit'
    await loadRoomTypes(d.hotel_id)
    formVisible.value = true
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

// 复制预定：预填客户/酒店/日期/明细/成本/双早/渠道/备注，清空权益人/权益勾选/结算状态；手续费率按渠道取默认
async function openCopy(row) {
  try {
    const d = await bookingsApi.detail(row.id)
    Object.assign(form, emptyForm(), {
      customer_id: d.customer_id,
      hotel_id: d.hotel_id,
      dateRange: [dateText(d.check_in), dateText(d.check_out)],
      items: (d.items || []).map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
      cost_total: Number(d.cost_total || 0),
      breakfast_included: !!d.breakfast_included,
      channel: d.channel || 'xianyu',
      fee_rate_pct: defaultFeeRatePct(d.channel || 'xianyu'),
      notes: d.notes || '',
    })
    feeRateTouched.value = false
    formMode.value = 'copy'
    await loadRoomTypes(d.hotel_id)
    formVisible.value = true
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

async function onHotelChange() {
  form.items = form.items.map((it) => ({ ...it, room_type_id: null }))
  await loadRoomTypes(form.hotel_id)
}

async function loadRoomTypes(hotelId) {
  if (!hotelId) {
    roomTypeOptions.value = []
    return
  }
  try {
    roomTypeOptions.value = await roomTypesApi.listByHotel(hotelId)
  } catch (e) {
    roomTypeOptions.value = []
  }
}

function addItem() {
  form.items.push({ room_type_id: null, price: null })
}

function removeItem(index) {
  form.items.splice(index, 1)
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!form.dateRange?.[0] || !form.dateRange?.[1]) {
    ElMessage.warning('请选择入住/离店日期')
    return
  }
  if (!form.items.length || form.items.some((it) => !it.room_type_id)) {
    ElMessage.warning('每行明细需选择房型')
    return
  }
  if (form.items.some((it) => it.price === null || it.price === undefined || it.price < 0)) {
    ElMessage.warning('请为每行明细填写不小于 0 的每晚价')
    return
  }
  if (form.benefit_used && !form.benefit_holder_id) {
    ElMessage.warning('使用升级权益需选择预订人')
    return
  }
  const count = Number(form.benefit_count_used)
  if (form.benefit_used && (!Number.isInteger(count) || count < 1 || count > 99)) {
    ElMessage.warning('权益张数应为 1-99 的整数')
    return
  }
  const payload = {
    customer_id: form.customer_id,
    hotel_id: form.hotel_id,
    benefit_holder_id: form.benefit_holder_id ?? null,
    check_in: form.dateRange[0],
    check_out: form.dateRange[1],
    cost_total: Number(form.cost_total || 0),
    benefit_used: form.benefit_used ? 1 : 0,
    benefit_count_used: form.benefit_used ? count : 1,
    holder_settled: form.holder_settled ? 1 : 0,
    breakfast_included: form.breakfast_included ? 1 : 0,
    channel: form.channel,
    fee_rate: feeRatePayload(),
    order_time: toDatetimeString(form.order_time),
    status: form.status,
    notes: form.notes || '',
    items: form.items.map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
  }
  saving.value = true
  try {
    if (formMode.value === 'edit' && form.id) {
      await bookingsApi.update(form.id, payload)
      ElMessage.success('预定已更新')
    } else {
      await bookingsApi.create(payload)
      ElMessage.success(formMode.value === 'copy' ? '已按复制内容新建预定' : '预定已创建')
    }
    formVisible.value = false
    await loadList()
    loadOptions()
  } catch (e) {
    // 400（如「该预订人剩余酒店权益不足」）等错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

// 列表「已结算」就地切换：拉详情 → 全量 PUT 翻转 holder_settled
const settleToggling = ref(false)
async function toggleSettled(row) {
  if (settleToggling.value) return
  settleToggling.value = true
  try {
    const d = await bookingsApi.detail(row.id)
    const next = row.holder_settled ? 0 : 1
    await bookingsApi.update(row.id, payloadFromDetail(d, { holder_settled: next }))
    row.holder_settled = next
    ElMessage.success(next ? '已标记为已结算' : '已取消结算标记')
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    settleToggling.value = false
  }
}

// V7 列表内改状态：拉详情 → 替换 status → 全量 PUT（权益扣减/返还由后端处理）
// 乐观更新行内状态，失败回滚并 toast；成功后重拉列表核对（权益/结算等衍生字段同步）
const inlineStatusChanging = ref({})
async function onInlineStatusChange(row, status) {
  if (status === row.status || inlineStatusChanging.value[row.id]) return
  const prev = row.status
  inlineStatusChanging.value[row.id] = true
  row.status = status // 乐观更新
  try {
    const d = await bookingsApi.detail(row.id)
    await bookingsApi.update(row.id, payloadFromDetail(d, { status }))
    ElMessage.success(`状态已改为「${statusMeta(status).label}」`)
    await loadList() // 重拉核对（权益流转由后端处理，行内衍生字段以服务端为准）
  } catch (e) {
    row.status = prev // 回滚（服务端 400 文案已由拦截器 toast）
  } finally {
    delete inlineStatusChanging.value[row.id]
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.customer_name} - ${row.hotel_name}」的预定吗？删除后将自动返还已占用的升级权益。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await bookingsApi.remove(row.id)
    ElMessage.success('预定已删除')
    await loadList()
    loadOptions()
  } catch (e) {
    // 409 等错误提示已由拦截器统一处理
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detail = ref({})

const flowPositionText = computed(() => {
  const step = statusStep(detail.value.status)
  return step ? `（流程第 ${step}/9 步）` : ''
})

async function openDetail(row) {
  try {
    detail.value = await bookingsApi.detail(row.id)
    detailVisible.value = true
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

onMounted(() => {
  loadOptions()
  loadList(1)
})
</script>

<style scoped>
.pager {
  margin: 12px 0;
  justify-content: flex-end;
}

.presence-alert {
  margin-bottom: 16px;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
  width: 100%;
}

.holder-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.holder-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nights-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

/* V13 移动端独立日期输入（表单 / 筛选） */
.mobile-date-range {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.filter-date-range {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.filter-date-range .el-date-editor {
  flex: 1;
  min-width: 0;
}

.range-sep {
  flex-shrink: 0;
  color: #909399;
  font-size: 13px;
}

.drawer-hint {
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.item-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.item-line {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  flex-wrap: wrap;
}

.item-room {
  flex: 1;
  min-width: 0;
}

.item-price-label {
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}

.item-price {
  width: 140px;
  flex-shrink: 0;
}

.item-subtotal {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.rate-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rate-chip {
  cursor: pointer;
  user-select: none;
}

.rate-chip:hover {
  opacity: 0.8;
}

.sale-summary {
  margin-left: 16px;
  font-size: 13px;
  color: #606266;
}

.benefit-block {
  width: 100%;
}

.benefit-line {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.settle-toggle {
  cursor: pointer;
}

.fee-unit {
  margin-left: 6px;
  font-size: 13px;
  color: #606266;
}

.flow-step {
  margin-left: 6px;
  font-size: 12px;
  color: #909399;
}

.detail-items-title {
  margin: 20px 0 8px;
  color: #303133;
}
</style>
